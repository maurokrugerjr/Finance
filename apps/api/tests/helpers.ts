import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

let appInstance: FastifyInstance | undefined;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

export async function resetDatabase(app: FastifyInstance) {
  await app.prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "GoalContribution", "Goal", "Debt",
      "Transaction", "Category", "User"
    RESTART IDENTITY CASCADE
  `);
}

let emailCounter = 0;
export function uniqueEmail() {
  emailCounter += 1;
  return `user-${Date.now()}-${emailCounter}@example.com`;
}

export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<{ email: string; password: string; name: string }> = {},
) {
  const payload = {
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? "supersecret123",
    name: overrides.name ?? "Usuário Teste",
  };

  const res = await app.inject({ method: "POST", url: "/auth/register", payload });
  if (res.statusCode !== 201) {
    throw new Error(`registerUser failed: ${res.statusCode} ${res.payload}`);
  }
  const body = JSON.parse(res.payload) as { user: { id: string; email: string }; token: string };

  return {
    email: payload.email,
    password: payload.password,
    userId: body.user.id,
    token: body.token,
    authHeader: { authorization: `Bearer ${body.token}` },
  };
}

export async function createCategory(
  app: FastifyInstance,
  userId: string,
  overrides: Partial<{ name: string; kind: "INCOME" | "EXPENSE"; debtId: string }> = {},
) {
  return app.prisma.category.create({
    data: {
      name: overrides.name ?? "Alimentação",
      kind: overrides.kind ?? "EXPENSE",
      debtId: overrides.debtId,
      userId,
    },
  });
}

export async function createDebt(
  app: FastifyInstance,
  userId: string,
  overrides: Partial<{
    name: string;
    totalAmount: number;
    remainingAmount: number;
    interestRate: number;
    minimumPayment: number;
  }> = {},
) {
  const totalAmount = overrides.totalAmount ?? 1000;
  return app.prisma.debt.create({
    data: {
      name: overrides.name ?? "Cartão de crédito",
      totalAmount,
      remainingAmount: overrides.remainingAmount ?? totalAmount,
      interestRate: overrides.interestRate ?? 10,
      minimumPayment: overrides.minimumPayment ?? 50,
      userId,
    },
  });
}
