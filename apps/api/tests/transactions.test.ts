import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  getTestApp,
  resetDatabase,
  registerUser,
  createAccount,
  createCategory,
  createDebt,
} from "./helpers";

describe("transactions", () => {
  let app: FastifyInstance;
  let auth: Awaited<ReturnType<typeof registerUser>>;
  let accountId: string;
  let categoryId: string;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    auth = await registerUser(app);
    const account = await createAccount(app, auth.userId);
    const category = await createCategory(app, auth.userId);
    accountId = account.id;
    categoryId = category.id;
  });

  it("rejects requests without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/transactions" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a transaction and returns amount as a number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: auth.authHeader,
      payload: {
        description: "Supermercado",
        amount: 250.5,
        type: "EXPENSE",
        date: new Date().toISOString(),
        accountId,
        categoryId,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.amount).toBe(250.5);
    expect(typeof body.amount).toBe("number");
  });

  it("rejects an accountId belonging to another user", async () => {
    const other = await registerUser(app);
    const otherAccount = await createAccount(app, other.userId);

    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: auth.authHeader,
      payload: {
        description: "x",
        amount: 10,
        type: "EXPENSE",
        date: new Date().toISOString(),
        accountId: otherAccount.id,
        categoryId,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects a nonexistent categoryId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/transactions",
      headers: auth.authHeader,
      payload: {
        description: "x",
        amount: 10,
        type: "EXPENSE",
        date: new Date().toISOString(),
        accountId,
        categoryId: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("filters transactions by type", async () => {
    const incomeCategory = await createCategory(app, auth.userId, { name: "Salário", kind: "INCOME" });

    await app.prisma.transaction.create({
      data: {
        description: "Salário",
        amount: 5000,
        type: "INCOME",
        date: new Date(),
        userId: auth.userId,
        accountId,
        categoryId: incomeCategory.id,
      },
    });
    await app.prisma.transaction.create({
      data: {
        description: "Mercado",
        amount: 300,
        type: "EXPENSE",
        date: new Date(),
        userId: auth.userId,
        accountId,
        categoryId,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/transactions?type=INCOME",
      headers: auth.authHeader,
    });

    const body = JSON.parse(res.payload);
    expect(body).toHaveLength(1);
    expect(body[0].description).toBe("Salário");
  });

  it("returns 404 for a transaction belonging to another user", async () => {
    const other = await registerUser(app);
    const otherAccount = await createAccount(app, other.userId);
    const otherCategory = await createCategory(app, other.userId);
    const otherTransaction = await app.prisma.transaction.create({
      data: {
        description: "x",
        amount: 10,
        type: "EXPENSE",
        date: new Date(),
        userId: other.userId,
        accountId: otherAccount.id,
        categoryId: otherCategory.id,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/transactions/${otherTransaction.id}`,
      headers: auth.authHeader,
    });

    expect(res.statusCode).toBe(404);
  });

  it("updates a transaction", async () => {
    const created = await app.prisma.transaction.create({
      data: {
        description: "Original",
        amount: 100,
        type: "EXPENSE",
        date: new Date(),
        userId: auth.userId,
        accountId,
        categoryId,
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/transactions/${created.id}`,
      headers: auth.authHeader,
      payload: { amount: 300 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).amount).toBe(300);
  });

  it("deletes a transaction", async () => {
    const created = await app.prisma.transaction.create({
      data: {
        description: "Para deletar",
        amount: 10,
        type: "EXPENSE",
        date: new Date(),
        userId: auth.userId,
        accountId,
        categoryId,
      },
    });

    const del = await app.inject({
      method: "DELETE",
      url: `/transactions/${created.id}`,
      headers: auth.authHeader,
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/transactions/${created.id}`,
      headers: auth.authHeader,
    });
    expect(get.statusCode).toBe(404);
  });

  describe("debt sync via linked category", () => {
    it("decreases remainingAmount when creating a transaction in a debt-linked category", async () => {
      const debt = await createDebt(app, auth.userId, { totalAmount: 1000, remainingAmount: 1000 });
      const debtCategory = await createCategory(app, auth.userId, {
        name: "Pagamento cartão",
        debtId: debt.id,
      });

      const res = await app.inject({
        method: "POST",
        url: "/transactions",
        headers: auth.authHeader,
        payload: {
          description: "Pagamento",
          amount: 300,
          type: "EXPENSE",
          date: new Date().toISOString(),
          accountId,
          categoryId: debtCategory.id,
        },
      });
      expect(res.statusCode).toBe(201);

      const updatedDebt = await app.prisma.debt.findUniqueOrThrow({ where: { id: debt.id } });
      expect(Number(updatedDebt.remainingAmount)).toBe(700);
    });

    it("clamps remainingAmount at 0 when the transaction exceeds the balance", async () => {
      const debt = await createDebt(app, auth.userId, { totalAmount: 1000, remainingAmount: 200 });
      const debtCategory = await createCategory(app, auth.userId, { name: "Pagamento dívida", debtId: debt.id });

      await app.inject({
        method: "POST",
        url: "/transactions",
        headers: auth.authHeader,
        payload: {
          description: "Quitação",
          amount: 500,
          type: "EXPENSE",
          date: new Date().toISOString(),
          accountId,
          categoryId: debtCategory.id,
        },
      });

      const updatedDebt = await app.prisma.debt.findUniqueOrThrow({ where: { id: debt.id } });
      expect(Number(updatedDebt.remainingAmount)).toBe(0);
    });

    it("adjusts the debt by the delta when the transaction amount is updated", async () => {
      const debt = await createDebt(app, auth.userId, { totalAmount: 1000, remainingAmount: 1000 });
      const debtCategory = await createCategory(app, auth.userId, { name: "Pagamento dívida", debtId: debt.id });

      const created = await app.inject({
        method: "POST",
        url: "/transactions",
        headers: auth.authHeader,
        payload: {
          description: "Pagamento",
          amount: 300,
          type: "EXPENSE",
          date: new Date().toISOString(),
          accountId,
          categoryId: debtCategory.id,
        },
      });
      const transactionId = JSON.parse(created.payload).id;

      await app.inject({
        method: "PATCH",
        url: `/transactions/${transactionId}`,
        headers: auth.authHeader,
        payload: { amount: 450 },
      });

      const updatedDebt = await app.prisma.debt.findUniqueOrThrow({ where: { id: debt.id } });
      expect(Number(updatedDebt.remainingAmount)).toBe(550);
    });

    it("moves the debt adjustment when the transaction is reassigned to a different debt-linked category", async () => {
      const debtA = await createDebt(app, auth.userId, { name: "A", totalAmount: 1000, remainingAmount: 1000 });
      const debtB = await createDebt(app, auth.userId, { name: "B", totalAmount: 1000, remainingAmount: 1000 });
      const categoryA = await createCategory(app, auth.userId, { name: "Cat A", debtId: debtA.id });
      const categoryB = await createCategory(app, auth.userId, { name: "Cat B", debtId: debtB.id });

      const created = await app.inject({
        method: "POST",
        url: "/transactions",
        headers: auth.authHeader,
        payload: {
          description: "Pagamento",
          amount: 300,
          type: "EXPENSE",
          date: new Date().toISOString(),
          accountId,
          categoryId: categoryA.id,
        },
      });
      const transactionId = JSON.parse(created.payload).id;

      await app.inject({
        method: "PATCH",
        url: `/transactions/${transactionId}`,
        headers: auth.authHeader,
        payload: { categoryId: categoryB.id },
      });

      const [updatedA, updatedB] = await Promise.all([
        app.prisma.debt.findUniqueOrThrow({ where: { id: debtA.id } }),
        app.prisma.debt.findUniqueOrThrow({ where: { id: debtB.id } }),
      ]);
      expect(Number(updatedA.remainingAmount)).toBe(1000);
      expect(Number(updatedB.remainingAmount)).toBe(700);
    });

    it("restores remainingAmount (capped at totalAmount) when the transaction is deleted", async () => {
      const debt = await createDebt(app, auth.userId, { totalAmount: 1000, remainingAmount: 1000 });
      const debtCategory = await createCategory(app, auth.userId, { name: "Pagamento dívida", debtId: debt.id });

      const created = await app.inject({
        method: "POST",
        url: "/transactions",
        headers: auth.authHeader,
        payload: {
          description: "Pagamento",
          amount: 300,
          type: "EXPENSE",
          date: new Date().toISOString(),
          accountId,
          categoryId: debtCategory.id,
        },
      });
      const transactionId = JSON.parse(created.payload).id;

      const del = await app.inject({
        method: "DELETE",
        url: `/transactions/${transactionId}`,
        headers: auth.authHeader,
      });
      expect(del.statusCode).toBe(204);

      const updatedDebt = await app.prisma.debt.findUniqueOrThrow({ where: { id: debt.id } });
      expect(Number(updatedDebt.remainingAmount)).toBe(1000);
    });

    it("does not affect any debt when the category has no debtId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/transactions",
        headers: auth.authHeader,
        payload: {
          description: "Mercado",
          amount: 100,
          type: "EXPENSE",
          date: new Date().toISOString(),
          accountId,
          categoryId,
        },
      });
      expect(res.statusCode).toBe(201);
      // categoryId (do beforeEach) não tem debtId; nada deve quebrar/mudar em Debt.
      expect(await app.prisma.debt.count()).toBe(0);
    });
  });
});
