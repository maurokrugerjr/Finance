import { describe, expect, it } from "vitest";
import { simulateDebtPayoff, type DebtInput } from "../src/modules/debts/simulate";

describe("simulateDebtPayoff", () => {
  it("returns an immediate payoff when there are no debts", () => {
    const result = simulateDebtPayoff([], 0, "SNOWBALL");

    expect(result).toMatchObject({ possible: true, months: 0, totalInterestPaid: 0, payoffOrder: [] });
  });

  it("computes exact months and zero interest for a 0% APR debt", () => {
    const debts: DebtInput[] = [
      { id: "a", name: "Sem juros", remainingAmount: 1200, interestRate: 0, minimumPayment: 100 },
    ];

    const result = simulateDebtPayoff(debts, 0, "SNOWBALL");

    expect(result.possible).toBe(true);
    expect(result.months).toBe(12);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.payoffOrder).toEqual([{ debtId: "a", name: "Sem juros", month: 12 }]);
  });

  it("pays off the smallest balance first under snowball", () => {
    const debts: DebtInput[] = [
      { id: "big", name: "Maior saldo", remainingAmount: 1000, interestRate: 20, minimumPayment: 50 },
      { id: "small", name: "Menor saldo", remainingAmount: 200, interestRate: 5, minimumPayment: 20 },
    ];

    const result = simulateDebtPayoff(debts, 100, "SNOWBALL");

    expect(result.payoffOrder[0]?.debtId).toBe("small");
    expect(result.payoffOrder[1]?.debtId).toBe("big");
  });

  it("pays off the highest interest rate first under avalanche", () => {
    const debts: DebtInput[] = [
      { id: "big", name: "Maior saldo", remainingAmount: 1000, interestRate: 20, minimumPayment: 50 },
      { id: "small", name: "Menor saldo", remainingAmount: 200, interestRate: 5, minimumPayment: 20 },
    ];

    const result = simulateDebtPayoff(debts, 100, "AVALANCHE");

    expect(result.payoffOrder[0]?.debtId).toBe("big");
    expect(result.payoffOrder[1]?.debtId).toBe("small");
  });

  it("avalanche never pays more total interest than snowball for the same debts", () => {
    const debts: DebtInput[] = [
      { id: "a", name: "Cartão", remainingAmount: 3000, interestRate: 24, minimumPayment: 100 },
      { id: "b", name: "Empréstimo", remainingAmount: 800, interestRate: 6, minimumPayment: 50 },
      { id: "c", name: "Financiamento", remainingAmount: 5000, interestRate: 10, minimumPayment: 150 },
    ];

    const snowball = simulateDebtPayoff(debts, 200, "SNOWBALL");
    const avalanche = simulateDebtPayoff(debts, 200, "AVALANCHE");

    expect(snowball.possible).toBe(true);
    expect(avalanche.possible).toBe(true);
    expect(avalanche.totalInterestPaid).toBeLessThanOrEqual(snowball.totalInterestPaid);
  });

  it("rolls a paid-off debt's minimum payment into the next target debt", () => {
    // "small" quita rápido; a partir daí seu mínimo (20) deve somar ao extra
    // aplicado em "big", acelerando a quitação em relação a não ter esse aporte.
    const debts: DebtInput[] = [
      { id: "small", name: "Pequena", remainingAmount: 100, interestRate: 0, minimumPayment: 100 },
      { id: "big", name: "Grande", remainingAmount: 1000, interestRate: 0, minimumPayment: 50 },
    ];

    const result = simulateDebtPayoff(debts, 0, "SNOWBALL");

    // Mês 1: small quitada (100 de mínimo). big paga 50 (mínimo) -> resta 950.
    // Mês 2 em diante: o mínimo de small (100) some ao mínimo de big (50) = 150/mês.
    // Restam 950 após o mês 1; 950 / 150 = 6.33 -> mais 7 meses = mês 8 total.
    expect(result.payoffOrder.find((s) => s.debtId === "small")?.month).toBe(1);
    expect(result.months).toBe(8);
  });

  it("marks the plan impossible when payments never cover the accruing interest", () => {
    const debts: DebtInput[] = [
      { id: "a", name: "Impagável", remainingAmount: 100000, interestRate: 100, minimumPayment: 1 },
    ];

    const result = simulateDebtPayoff(debts, 0, "SNOWBALL");

    expect(result.possible).toBe(false);
    expect(result.months).toBeNull();
    expect(result.debtFreeDate).toBeNull();
    expect(result.message).toBeTruthy();
  });
});
