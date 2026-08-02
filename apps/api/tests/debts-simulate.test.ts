import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp, resetDatabase, registerUser } from "./helpers";

describe("POST /debts/simulate", () => {
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
    const res = await app.inject({ method: "POST", url: "/debts/simulate" });
    expect(res.statusCode).toBe(401);
  });

  it("returns a zero-month plan when the user has no debts", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/debts/simulate",
      headers: auth.authHeader,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.snowball).toMatchObject({ possible: true, months: 0 });
    expect(body.avalanche).toMatchObject({ possible: true, months: 0 });
  });

  it("works with no request body at all (defaults extraMonthlyPayment to 0)", async () => {
    await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Dívida", totalAmount: 1200, interestRate: 0, minimumPayment: 100 },
    });

    const res = await app.inject({ method: "POST", url: "/debts/simulate", headers: auth.authHeader });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).snowball.months).toBe(12);
  });

  it("simulates both strategies scoped to the user's own debts", async () => {
    await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Cartão", totalAmount: 3000, interestRate: 24, minimumPayment: 100 },
    });
    await app.inject({
      method: "POST",
      url: "/debts",
      headers: auth.authHeader,
      payload: { name: "Empréstimo", totalAmount: 800, interestRate: 6, minimumPayment: 50 },
    });

    const other = await registerUser(app);
    await app.inject({
      method: "POST",
      url: "/debts",
      headers: other.authHeader,
      payload: { name: "Dívida de outro usuário", totalAmount: 999999, interestRate: 50, minimumPayment: 1 },
    });

    const res = await app.inject({
      method: "POST",
      url: "/debts/simulate",
      headers: auth.authHeader,
      payload: { extraMonthlyPayment: 200 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);

    expect(body.snowball.possible).toBe(true);
    expect(body.avalanche.possible).toBe(true);
    expect(body.snowball.payoffOrder).toHaveLength(2);
    expect(body.avalanche.payoffOrder).toHaveLength(2);
    // Avalanche prioriza o cartão (24%) primeiro; a dívida do outro usuário não aparece.
    expect(body.avalanche.payoffOrder[0].name).toBe("Cartão");
    expect(body.avalanche.totalInterestPaid).toBeLessThanOrEqual(body.snowball.totalInterestPaid);
  });

  it("rejects a negative extraMonthlyPayment", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/debts/simulate",
      headers: auth.authHeader,
      payload: { extraMonthlyPayment: -50 },
    });

    expect(res.statusCode).toBe(400);
  });
});
