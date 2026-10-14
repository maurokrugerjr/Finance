import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  getTestApp,
  resetDatabase,
  registerUser,
  createCategory,
  createDebt,
} from "./helpers";

describe("categories", () => {
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
    const res = await app.inject({ method: "GET", url: "/categories" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a category", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: auth.authHeader,
      payload: { name: "Alimentação", kind: "EXPENSE" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body).toMatchObject({ name: "Alimentação", kind: "EXPENSE" });
  });

  it("rejects a duplicate name+kind with 409", async () => {
    await createCategory(app, auth.userId, { name: "Alimentação", kind: "EXPENSE" });

    const res = await app.inject({
      method: "POST",
      url: "/categories",
      headers: auth.authHeader,
      payload: { name: "Alimentação", kind: "EXPENSE" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("lists categories scoped to the authenticated user, filterable by kind", async () => {
    await createCategory(app, auth.userId, { name: "Salário", kind: "INCOME" });
    await createCategory(app, auth.userId, { name: "Mercado", kind: "EXPENSE" });

    const other = await registerUser(app);
    await createCategory(app, other.userId, { name: "Categoria de outro usuário", kind: "EXPENSE" });

    const all = await app.inject({ method: "GET", url: "/categories", headers: auth.authHeader });
    expect(JSON.parse(all.payload)).toHaveLength(2);

    const onlyIncome = await app.inject({
      method: "GET",
      url: "/categories?kind=INCOME",
      headers: auth.authHeader,
    });
    const incomeBody = JSON.parse(onlyIncome.payload);
    expect(incomeBody).toHaveLength(1);
    expect(incomeBody[0].name).toBe("Salário");
  });

  it("returns 404 for a category belonging to another user", async () => {
    const other = await registerUser(app);
    const otherCategory = await createCategory(app, other.userId);

    const res = await app.inject({
      method: "GET",
      url: `/categories/${otherCategory.id}`,
      headers: auth.authHeader,
    });

    expect(res.statusCode).toBe(404);
  });

  it("updates a category", async () => {
    const category = await createCategory(app, auth.userId);

    const res = await app.inject({
      method: "PATCH",
      url: `/categories/${category.id}`,
      headers: auth.authHeader,
      payload: { color: "#ff0000" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).color).toBe("#ff0000");
  });

  it("deletes a category with no transactions", async () => {
    const category = await createCategory(app, auth.userId);

    const del = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: auth.authHeader,
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: "GET",
      url: `/categories/${category.id}`,
      headers: auth.authHeader,
    });
    expect(get.statusCode).toBe(404);
  });

  it("refuses to delete a category that has transactions", async () => {
    const category = await createCategory(app, auth.userId);
    await app.prisma.transaction.create({
      data: {
        description: "Compra",
        amount: 50,
        type: "EXPENSE",
        date: new Date(),
        userId: auth.userId,
        categoryId: category.id,
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/categories/${category.id}`,
      headers: auth.authHeader,
    });

    expect(res.statusCode).toBe(409);
  });

  describe("debt link", () => {
    it("creates an EXPENSE category linked to a debt", async () => {
      const debt = await createDebt(app, auth.userId);

      const res = await app.inject({
        method: "POST",
        url: "/categories",
        headers: auth.authHeader,
        payload: { name: "Pagamento do cartão", kind: "EXPENSE", debtId: debt.id },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.payload).debtId).toBe(debt.id);
    });

    it("rejects linking an INCOME category to a debt", async () => {
      const debt = await createDebt(app, auth.userId);

      const res = await app.inject({
        method: "POST",
        url: "/categories",
        headers: auth.authHeader,
        payload: { name: "Salário", kind: "INCOME", debtId: debt.id },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects linking to a debt that belongs to another user", async () => {
      const other = await registerUser(app);
      const otherDebt = await createDebt(app, other.userId);

      const res = await app.inject({
        method: "POST",
        url: "/categories",
        headers: auth.authHeader,
        payload: { name: "Pagamento", kind: "EXPENSE", debtId: otherDebt.id },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects a nonexistent debtId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/categories",
        headers: auth.authHeader,
        payload: {
          name: "Pagamento",
          kind: "EXPENSE",
          debtId: "00000000-0000-0000-0000-000000000000",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("allows unlinking a debt via PATCH with debtId: null", async () => {
      const debt = await createDebt(app, auth.userId);
      const category = await createCategory(app, auth.userId, { debtId: debt.id });

      const res = await app.inject({
        method: "PATCH",
        url: `/categories/${category.id}`,
        headers: auth.authHeader,
        payload: { debtId: null },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).debtId).toBeNull();
    });
  });
});
