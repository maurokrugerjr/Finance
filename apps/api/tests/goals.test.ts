import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp, resetDatabase, registerUser } from "./helpers";

describe("goals", () => {
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
    const res = await app.inject({ method: "GET", url: "/goals" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a goal defaulting currentAmount to 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/goals",
      headers: auth.authHeader,
      payload: { name: "Viagem", targetAmount: 5000 },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.currentAmount).toBe(0);
    expect(typeof body.targetAmount).toBe("number");
  });

  it("lists goals scoped to the authenticated user", async () => {
    await app.inject({
      method: "POST",
      url: "/goals",
      headers: auth.authHeader,
      payload: { name: "Meta A", targetAmount: 1000 },
    });

    const other = await registerUser(app);
    await app.inject({
      method: "POST",
      url: "/goals",
      headers: other.authHeader,
      payload: { name: "Meta de outro usuário", targetAmount: 1 },
    });

    const res = await app.inject({ method: "GET", url: "/goals", headers: auth.authHeader });
    const body = JSON.parse(res.payload);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Meta A");
  });

  it("returns 404 for a goal belonging to another user", async () => {
    const other = await registerUser(app);
    const created = await app.inject({
      method: "POST",
      url: "/goals",
      headers: other.authHeader,
      payload: { name: "x", targetAmount: 1 },
    });
    const goalId = JSON.parse(created.payload).id;

    const res = await app.inject({
      method: "GET",
      url: `/goals/${goalId}`,
      headers: auth.authHeader,
    });
    expect(res.statusCode).toBe(404);
  });

  it("updates a goal", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/goals",
      headers: auth.authHeader,
      payload: { name: "Original", targetAmount: 1000 },
    });
    const goalId = JSON.parse(created.payload).id;

    const res = await app.inject({
      method: "PATCH",
      url: `/goals/${goalId}`,
      headers: auth.authHeader,
      payload: { targetAmount: 2000 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).targetAmount).toBe(2000);
  });

  it("deletes a goal", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/goals",
      headers: auth.authHeader,
      payload: { name: "Para deletar", targetAmount: 1000 },
    });
    const goalId = JSON.parse(created.payload).id;

    const del = await app.inject({
      method: "DELETE",
      url: `/goals/${goalId}`,
      headers: auth.authHeader,
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/goals/${goalId}`,
      headers: auth.authHeader,
    });
    expect(get.statusCode).toBe(404);
  });

  describe("contributions", () => {
    async function createGoal() {
      const res = await app.inject({
        method: "POST",
        url: "/goals",
        headers: auth.authHeader,
        payload: { name: "Meta com aportes", targetAmount: 1000 },
      });
      return JSON.parse(res.payload) as { id: string };
    }

    it("records a contribution and increases currentAmount", async () => {
      const goal = await createGoal();

      const res = await app.inject({
        method: "POST",
        url: `/goals/${goal.id}/contributions`,
        headers: auth.authHeader,
        payload: { amount: 300, date: new Date().toISOString() },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.contribution.amount).toBe(300);
      expect(body.goal.currentAmount).toBe(300);
    });

    it("accumulates across multiple contributions", async () => {
      const goal = await createGoal();

      await app.inject({
        method: "POST",
        url: `/goals/${goal.id}/contributions`,
        headers: auth.authHeader,
        payload: { amount: 300, date: new Date().toISOString() },
      });
      const second = await app.inject({
        method: "POST",
        url: `/goals/${goal.id}/contributions`,
        headers: auth.authHeader,
        payload: { amount: 250, date: new Date().toISOString() },
      });

      expect(JSON.parse(second.payload).goal.currentAmount).toBe(550);
    });

    it("lists contributions for a goal", async () => {
      const goal = await createGoal();
      await app.inject({
        method: "POST",
        url: `/goals/${goal.id}/contributions`,
        headers: auth.authHeader,
        payload: { amount: 100, date: new Date().toISOString() },
      });

      const res = await app.inject({
        method: "GET",
        url: `/goals/${goal.id}/contributions`,
        headers: auth.authHeader,
      });
      expect(JSON.parse(res.payload)).toHaveLength(1);
    });

    it("reverts currentAmount when a contribution is deleted", async () => {
      const goal = await createGoal();
      const contribution = await app.inject({
        method: "POST",
        url: `/goals/${goal.id}/contributions`,
        headers: auth.authHeader,
        payload: { amount: 300, date: new Date().toISOString() },
      });
      const contributionId = JSON.parse(contribution.payload).contribution.id;

      const del = await app.inject({
        method: "DELETE",
        url: `/goals/${goal.id}/contributions/${contributionId}`,
        headers: auth.authHeader,
      });
      expect(del.statusCode).toBe(204);

      const get = await app.inject({
        method: "GET",
        url: `/goals/${goal.id}`,
        headers: auth.authHeader,
      });
      expect(JSON.parse(get.payload).currentAmount).toBe(0);
    });
  });
});
