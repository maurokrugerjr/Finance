import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp, resetDatabase, registerUser, createCategory, createDebt } from "./helpers";

describe("GET /dashboard/summary", () => {
  let app: FastifyInstance;
  let auth: Awaited<ReturnType<typeof registerUser>>;

  async function createTransaction(
    userId: string,
    categoryId: string,
    data: {
      amount: number;
      date: string;
      type?: "INCOME" | "EXPENSE";
      paymentMethod?: "CREDIT" | "DEBIT";
    },
  ) {
    return app.prisma.transaction.create({
      data: {
        description: "x",
        amount: data.amount,
        type: data.type ?? "EXPENSE",
        paymentMethod: data.paymentMethod,
        date: new Date(data.date),
        userId,
        categoryId,
      },
    });
  }

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    auth = await registerUser(app);
  });

  it("rejects requests without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/dashboard/summary" });
    expect(res.statusCode).toBe(401);
  });

  it("returns zeroed totals for the current month when the user has no data", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: auth.authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const now = new Date();
    expect(new Date(body.period.from).toISOString()).toBe(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
    );
    expect(body.totals).toEqual({ income: 0, expense: 0, balance: 0 });
    expect(body.expensesByCategory).toEqual([]);
    expect(body.expensesByPaymentMethod).toEqual({ CREDIT: 0, DEBIT: 0, unspecified: 0 });
    expect(body.monthly).toHaveLength(6);
    expect(body.debts).toEqual({ count: 0, totalAmount: 0, remainingAmount: 0, minimumPaymentTotal: 0 });
    expect(body.goals).toEqual({ count: 0, targetAmount: 0, currentAmount: 0 });
  });

  it("aggregates totals, categories and payment methods within the period", async () => {
    const salary = await createCategory(app, auth.userId, { name: "Salário", kind: "INCOME" });
    const food = await createCategory(app, auth.userId, { name: "Alimentação" });
    const transport = await createCategory(app, auth.userId, { name: "Transporte" });

    await createTransaction(auth.userId, salary.id, { amount: 5000, type: "INCOME", date: "2026-03-05" });
    await createTransaction(auth.userId, food.id, { amount: 0.1, paymentMethod: "CREDIT", date: "2026-03-10" });
    await createTransaction(auth.userId, food.id, { amount: 0.2, paymentMethod: "CREDIT", date: "2026-03-11" });
    await createTransaction(auth.userId, transport.id, { amount: 150, paymentMethod: "DEBIT", date: "2026-03-12" });
    await createTransaction(auth.userId, transport.id, { amount: 50, date: "2026-03-20" });
    // Fora do período: não deve entrar nos totais.
    await createTransaction(auth.userId, food.id, { amount: 999, paymentMethod: "CREDIT", date: "2026-04-01" });

    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary?from=2026-03-01&to=2026-03-31T23:59:59.999Z",
      headers: auth.authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.totals).toEqual({ income: 5000, expense: 200.3, balance: 4799.7 });
    expect(body.expensesByCategory.map((c: { name: string; total: number }) => [c.name, c.total])).toEqual([
      ["Transporte", 200],
      ["Alimentação", 0.3],
    ]);
    expect(body.expensesByPaymentMethod).toEqual({ CREDIT: 0.3, DEBIT: 150, unspecified: 50 });
  });

  it("builds a monthly series ending at the month of `to`, including empty months", async () => {
    const salary = await createCategory(app, auth.userId, { name: "Salário", kind: "INCOME" });
    const food = await createCategory(app, auth.userId);

    await createTransaction(auth.userId, food.id, { amount: 70, date: "2025-12-15" }); // antes da janela
    await createTransaction(auth.userId, salary.id, { amount: 3000, type: "INCOME", date: "2026-01-05" });
    await createTransaction(auth.userId, food.id, { amount: 100, date: "2026-01-20" });
    await createTransaction(auth.userId, food.id, { amount: 40, date: "2026-03-02" });

    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary?from=2026-03-01&to=2026-03-31T23:59:59.999Z&months=3",
      headers: auth.authHeader,
    });

    const body = JSON.parse(res.payload);
    expect(body.monthly).toEqual([
      { month: "2026-01", income: 3000, expense: 100 },
      { month: "2026-02", income: 0, expense: 0 },
      { month: "2026-03", income: 0, expense: 40 },
    ]);
  });

  it("summarizes debts and goals", async () => {
    await createDebt(app, auth.userId, { totalAmount: 1000, remainingAmount: 600, minimumPayment: 100 });
    await createDebt(app, auth.userId, { totalAmount: 500, remainingAmount: 500, minimumPayment: 50 });
    await app.prisma.goal.create({
      data: { name: "Viagem", targetAmount: 8000, currentAmount: 2000, userId: auth.userId },
    });

    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: auth.authHeader,
    });

    const body = JSON.parse(res.payload);
    expect(body.debts).toEqual({ count: 2, totalAmount: 1500, remainingAmount: 1100, minimumPaymentTotal: 150 });
    expect(body.goals).toEqual({ count: 1, targetAmount: 8000, currentAmount: 2000 });
  });

  it("only counts the authenticated user's data", async () => {
    const other = await registerUser(app);
    const otherCategory = await createCategory(app, other.userId);
    await createTransaction(other.userId, otherCategory.id, { amount: 500, date: new Date().toISOString() });
    await createDebt(app, other.userId);

    const res = await app.inject({
      method: "GET",
      url: "/dashboard/summary",
      headers: auth.authHeader,
    });

    const body = JSON.parse(res.payload);
    expect(body.totals.expense).toBe(0);
    expect(body.expensesByCategory).toEqual([]);
    expect(body.debts.count).toBe(0);
  });

  it("rejects `from` after `to` and an out-of-range `months`", async () => {
    const inverted = await app.inject({
      method: "GET",
      url: "/dashboard/summary?from=2026-04-01&to=2026-03-01",
      headers: auth.authHeader,
    });
    expect(inverted.statusCode).toBe(400);

    const badMonths = await app.inject({
      method: "GET",
      url: "/dashboard/summary?months=0",
      headers: auth.authHeader,
    });
    expect(badMonths.statusCode).toBe(400);
  });
});
