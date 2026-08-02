import type { DebtPayoffPlan, DebtPayoffStep, DebtStrategy } from "@finance/types";

// Limite de segurança: se as dívidas não forem quitadas em 50 anos com os
// valores informados, tratamos como "não é possível" em vez de rodar para sempre.
const MAX_MONTHS = 600;

export interface DebtInput {
  id: string;
  name: string;
  remainingAmount: number;
  /** Taxa de juros anual em percentual (ex.: 12.5 para 12,5% a.a.). */
  interestRate: number;
  minimumPayment: number;
}

interface DebtState {
  balanceCents: number;
  minimumCents: number;
  monthlyRate: number;
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(cents: number) {
  return cents / 100;
}

function sortByStrategy(debts: DebtInput[], strategy: DebtStrategy): DebtInput[] {
  const sorted = [...debts];
  if (strategy === "SNOWBALL") {
    sorted.sort((a, b) => a.remainingAmount - b.remainingAmount || a.id.localeCompare(b.id));
  } else {
    sorted.sort((a, b) => b.interestRate - a.interestRate || a.id.localeCompare(b.id));
  }
  return sorted;
}

export function simulateDebtPayoff(
  debts: DebtInput[],
  extraMonthlyPayment: number,
  strategy: DebtStrategy,
): DebtPayoffPlan {
  const order = sortByStrategy(
    debts.filter((debt) => debt.remainingAmount > 0),
    strategy,
  );

  if (order.length === 0) {
    return {
      strategy,
      possible: true,
      months: 0,
      totalInterestPaid: 0,
      debtFreeDate: new Date(),
      payoffOrder: [],
    };
  }

  const working = new Map<string, DebtState>(
    order.map((debt) => [
      debt.id,
      {
        balanceCents: toCents(debt.remainingAmount),
        minimumCents: toCents(debt.minimumPayment),
        monthlyRate: debt.interestRate / 100 / 12,
      },
    ]),
  );

  const extraCents = toCents(extraMonthlyPayment);
  const paidOff = new Set<string>();
  const payoffOrder: DebtPayoffStep[] = [];
  let totalInterestCents = 0;
  let month = 0;

  while (paidOff.size < order.length && month < MAX_MONTHS) {
    month += 1;

    // 1. Juros do mês incidem sobre o saldo de cada dívida ainda em aberto.
    for (const debt of order) {
      if (paidOff.has(debt.id)) continue;
      const state = working.get(debt.id)!;
      const interest = Math.round(state.balanceCents * state.monthlyRate);
      state.balanceCents += interest;
      totalInterestCents += interest;
    }

    // 2. Paga o mínimo de cada dívida em aberto.
    for (const debt of order) {
      if (paidOff.has(debt.id)) continue;
      const state = working.get(debt.id)!;
      const payment = Math.min(state.balanceCents, state.minimumCents);
      state.balanceCents -= payment;
    }

    // 3. O valor extra (mais o mínimo já liberado por dívidas quitadas em
    // meses anteriores) vai inteiro para a dívida de maior prioridade da
    // estratégia; o que sobrar depois de quitá-la escorre para a próxima.
    let pool = extraCents;
    for (const debt of order) {
      if (paidOff.has(debt.id)) pool += working.get(debt.id)!.minimumCents;
    }

    for (const debt of order) {
      if (paidOff.has(debt.id) || pool <= 0) continue;
      const state = working.get(debt.id)!;
      const payment = Math.min(state.balanceCents, pool);
      state.balanceCents -= payment;
      pool -= payment;
    }

    // 4. Marca como quitadas as dívidas que zeraram neste mês.
    for (const debt of order) {
      if (paidOff.has(debt.id)) continue;
      const state = working.get(debt.id)!;
      if (state.balanceCents <= 0) {
        state.balanceCents = 0;
        paidOff.add(debt.id);
        payoffOrder.push({ debtId: debt.id, name: debt.name, month });
      }
    }
  }

  if (paidOff.size < order.length) {
    return {
      strategy,
      possible: false,
      months: null,
      totalInterestPaid: fromCents(totalInterestCents),
      debtFreeDate: null,
      payoffOrder,
      message:
        "Os pagamentos mínimos e o valor extra informado não são suficientes para quitar as dívidas em até 50 anos. Considere aumentar o valor extra mensal.",
    };
  }

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + month);

  return {
    strategy,
    possible: true,
    months: month,
    totalInterestPaid: fromCents(totalInterestCents),
    debtFreeDate,
    payoffOrder,
  };
}
