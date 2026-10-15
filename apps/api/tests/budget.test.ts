import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp, resetDatabase, registerUser, createCategory, createDebt } from "./helpers";

describe("budget plan", () => {
  let app: FastifyInstance;
  let auth: Awaited<ReturnType<typeof registerUser>>;

  async function categoryId(name: string) {
    const category = await app.prisma.category.findFirstOrThrow({ where: { userId: auth.userId, name } });
    return category.id;
  }

  async function putBudget(payload: unknown, headers = auth.authHeader) {
    return app.inject({ method: "PUT", url: "/budget", headers, payload: payload as object });
  }

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    auth = await registerUser(app);
  });

  it("rejects requests without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/budget" });
    expect(res.statusCode).toBe(401);
  });

  it("starts with the suggested plan (100%) and no income set", async () => {
    const res = await app.inject({ method: "GET", url: "/budget", headers: auth.authHeader });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.monthlyIncome).toBeNull();
    expect(body.totalPercent).toBe(100);
    expect(body.items).toHaveLength(9);
    expect(body.items.every((item: { planned: number }) => item.planned === 0)).toBe(true);
    // Essenciais primeiro, depois dívidas, reserva e estilo de vida.
    expect(body.items[0]).toMatchObject({ name: "Moradia e contas", group: "ESSENTIALS", percent: 20 });
  });

  it("saves the income and replaces the plan, computing planned amounts", async () => {
    const res = await putBudget({
      monthlyIncome: 5000,
      items: [
        { categoryId: await categoryId("Mercado"), group: "ESSENTIALS", percent: 15 },
        { categoryId: await categoryId("Quitação de dívidas"), group: "DEBTS", percent: 12.5 },
      ],
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.monthlyIncome).toBe(5000);
    expect(body.totalPercent).toBe(27.5);
    expect(body.items.map((i: { name: string; planned: number }) => [i.name, i.planned])).toEqual([
      ["Mercado", 750],
      ["Quitação de dívidas", 625],
    ]);
  });

  it("rejects plans above 100%, duplicated categories and non-positive income", async () => {
    const market = await categoryId("Mercado");
    const fuel = await categoryId("Gasolina");

    const over = await putBudget({
      monthlyIncome: 5000,
      items: [
        { categoryId: market, group: "ESSENTIALS", percent: 60 },
        { categoryId: fuel, group: "ESSENTIALS", percent: 41 },
      ],
    });
    const duplicated = await putBudget({
      monthlyIncome: 5000,
      items: [
        { categoryId: market, group: "ESSENTIALS", percent: 10 },
        { categoryId: market, group: "ESSENTIALS", percent: 10 },
      ],
    });
    const noIncome = await putBudget({ monthlyIncome: 0, items: [] });

    expect([over.statusCode, duplicated.statusCode, noIncome.statusCode]).toEqual([400, 400, 400]);
  });

  it("rejects income categories and categories from another user", async () => {
    const other = await registerUser(app);
    const otherCategory = await createCategory(app, other.userId, { name: "Do outro" });

    const income = await putBudget({
      monthlyIncome: 5000,
      items: [{ categoryId: await categoryId("Salário"), group: "ESSENTIALS", percent: 10 }],
    });
    const foreign = await putBudget({
      monthlyIncome: 5000,
      items: [{ categoryId: otherCategory.id, group: "ESSENTIALS", percent: 10 }],
    });

    expect(income.statusCode).toBe(400);
    expect(foreign.statusCode).toBe(400);
  });

  it("removes a category from the plan when it becomes an INCOME category", async () => {
    const market = await categoryId("Mercado");
    await app.inject({
      method: "PATCH",
      url: `/categories/${market}`,
      headers: auth.authHeader,
      payload: { kind: "INCOME" },
    });

    const res = await app.inject({ method: "GET", url: "/budget", headers: auth.authHeader });
    const names = JSON.parse(res.payload).items.map((i: { name: string }) => i.name);
    expect(names).not.toContain("Mercado");
  });

  describe("in the dashboard summary", () => {
    it("shows planned vs spent per plan item for the period", async () => {
      const market = await categoryId("Mercado");
      await putBudget({
        monthlyIncome: 5000,
        items: [{ categoryId: market, group: "ESSENTIALS", percent: 15 }],
      });
      await app.prisma.transaction.create({
        data: {
          description: "Compra do mês",
          amount: 600,
          type: "EXPENSE",
          date: new Date("2026-03-10"),
          userId: auth.userId,
          categoryId: market,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/dashboard/summary?from=2026-03-01&to=2026-03-31T23:59:59.999Z",
        headers: auth.authHeader,
      });

      const body = JSON.parse(res.payload);
      expect(body.budget).toEqual({
        monthlyIncome: 5000,
        items: [
          { categoryId: market, name: "Mercado", group: "ESSENTIALS", percent: 15, planned: 750, spent: 600 },
        ],
      });
    });

    it("projects the debt-free date using the DEBTS slice as the monthly payment", async () => {
      await createDebt(app, auth.userId, {
        totalAmount: 1200,
        remainingAmount: 1200,
        interestRate: 0,
        minimumPayment: 100,
      });
      await putBudget({
        monthlyIncome: 4000,
        items: [{ categoryId: await categoryId("Quitação de dívidas"), group: "DEBTS", percent: 10 }],
      });

      const res = await app.inject({ method: "GET", url: "/dashboard/summary", headers: auth.authHeader });

      // R$ 400/mês sem juros quitam R$ 1.200 em 3 meses.
      expect(JSON.parse(res.payload).debtPayoff).toMatchObject({
        monthlyPayment: 400,
        possible: true,
        months: 3,
      });
    });

    it("has no debt projection when the user has no open debts", async () => {
      await putBudget({
        monthlyIncome: 4000,
        items: [{ categoryId: await categoryId("Quitação de dívidas"), group: "DEBTS", percent: 10 }],
      });

      const res = await app.inject({ method: "GET", url: "/dashboard/summary", headers: auth.authHeader });
      expect(JSON.parse(res.payload).debtPayoff).toBeNull();
    });
  });
});
