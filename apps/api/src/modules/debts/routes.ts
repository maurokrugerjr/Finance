import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { debtCreateInput, debtUpdateInput, simulateDebtsInput } from "@finance/types";
import { simulateDebtPayoff } from "./simulate";

const paramsSchema = z.object({ id: z.string().uuid() });

function serializeDebt<
  T extends {
    totalAmount: Prisma.Decimal;
    remainingAmount: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    minimumPayment: Prisma.Decimal;
  },
>(debt: T) {
  return {
    ...debt,
    totalAmount: Number(debt.totalAmount),
    remainingAmount: Number(debt.remainingAmount),
    interestRate: Number(debt.interestRate),
    minimumPayment: Number(debt.minimumPayment),
  };
}

export const debtRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const debts = await app.prisma.debt.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: "asc" },
    });
    return debts.map(serializeDebt);
  });

  app.get("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const debt = await app.prisma.debt.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!debt) return reply.notFound("Debt not found");

    return serializeDebt(debt);
  });

  app.post("/", async (request, reply) => {
    const body = debtCreateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const { remainingAmount, totalAmount, ...rest } = body.data;

    const debt = await app.prisma.debt.create({
      data: {
        ...rest,
        totalAmount,
        remainingAmount: remainingAmount ?? totalAmount,
        userId: request.user.userId,
      },
    });

    return reply.code(201).send(serializeDebt(debt));
  });

  // Para "pagar" uma dívida, atualize remainingAmount diretamente aqui (ou
  // deixe uma transação em categoria vinculada fazer isso automaticamente —
  // ver módulo transactions). Não há um histórico de pagamentos separado.
  app.patch("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const body = debtUpdateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const existing = await app.prisma.debt.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!existing) return reply.notFound("Debt not found");

    const debt = await app.prisma.debt.update({
      where: { id: existing.id },
      data: body.data,
    });

    return serializeDebt(debt);
  });

  app.delete("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const existing = await app.prisma.debt.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!existing) return reply.notFound("Debt not found");

    await app.prisma.debt.delete({ where: { id: existing.id } });
    return reply.code(204).send();
  });

  app.post("/simulate", async (request, reply) => {
    const body = simulateDebtsInput.safeParse(request.body ?? {});
    if (!body.success) return reply.badRequest(body.error.message);

    const debts = await app.prisma.debt.findMany({ where: { userId: request.user.userId } });
    const input = debts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      remainingAmount: Number(debt.remainingAmount),
      interestRate: Number(debt.interestRate),
      minimumPayment: Number(debt.minimumPayment),
    }));

    const { extraMonthlyPayment } = body.data;

    return {
      snowball: simulateDebtPayoff(input, extraMonthlyPayment, "SNOWBALL"),
      avalanche: simulateDebtPayoff(input, extraMonthlyPayment, "AVALANCHE"),
    };
  });
};
