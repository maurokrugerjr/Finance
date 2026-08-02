import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp, resetDatabase, registerUser } from "./helpers";

describe("debts", () => {
  let app: FastifyInstance;
  let auth: Awaited<ReturnType<typeof registerUser>>;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
    auth = await registerUser(app);
  });

  it("rejects requests without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/debts" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a debt defaulting remainingAmount to totalAmount", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: {
        name: "Cartão de crédito",
        totalAmount: 5000,
        interestRate: 12.5,
        minimumPayment: 300,
        dueDay: 10,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.remainingAmount).toBe(5000);
    expect(typeof body.totalAmount).toBe("number");
    expect(typeof body.interestRate).toBe("number");
  });

  it("creates a debt with an explicit remainingAmount", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: {
        name: "Empréstimo",
        totalAmount: 10000,
        remainingAmount: 7000,
        interestRate: 3,
        minimumPayment: 500,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.payload).remainingAmount).toBe(7000);
  });

  it("lists debts scoped to the authenticated user", async () => {
    await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Dívida A", totalAmount: 1000, interestRate: 1, minimumPayment: 50 },
    });

    const other = await registerUser(app);
    await app.inject({
      method: "POST",
      url: "/debts",
      headers: other.authHeader,
      payload: { name: "Dívida de outro usuário", totalAmount: 1, interestRate: 1, minimumPayment: 1 },
    });

    const res = await app.inject({ method: "GET", url: "/debts", headers: auth.authHeader });
    const body = JSON.parse(res.payload);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Dívida A");
  });

  it("returns 404 for a debt belonging to another user", async () => {
    const other = await registerUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/debts",
      headers: other.authHeader,
      payload: { name: "x", totalAmount: 1, interestRate: 1, minimumPayment: 1 },
    });
    const debtId = JSON.parse(created.payload).id;

    const res = await app.inject({
      method: "GET",
      url: `/debts/${debtId}`,
      headers: auth.authHeader,
    });
    expect(res.statusCode).toBe(404);
  });

  it("updates a debt", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Original", totalAmount: 1000, interestRate: 1, minimumPayment: 50 },
    });
    const debtId = JSON.parse(created.payload).id;

    const res = await app.inject({
      method: "PATCH",
      url: `/debts/${debtId}`,
      headers: auth.authHeader,
      payload: { minimumPayment: 100 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).minimumPayment).toBe(100);
  });

  it("deletes a debt", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Para deletar", totalAmount: 1000, interestRate: 1, minimumPayment: 50 },
    });
    const debtId = JSON.parse(created.payload).id;

    const del = await app.inject({
      method: "DELETE",
      url: `/debts/${debtId}`,
      headers: auth.authHeader,
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/debts/${debtId}`,
      headers: auth.authHeader,
    });
    expect(get.statusCode).toBe(404);
  });

  it("pays down a debt by updating remainingAmount directly via PATCH", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Cartão", totalAmount: 1000, interestRate: 2, minimumPayment: 100 },
    });
    const debtId = JSON.parse(created.payload).id;

    const res = await app.inject({
      method: "PATCH",
      url: `/debts/${debtId}`,
      headers: auth.authHeader,
      payload: { remainingAmount: 700 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).remainingAmount).toBe(700);
  });
});
