import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { transactionCreateInput, transactionUpdateInput, CategoryKind } from "@finance/types";
import { applyDebtPayment, reverseDebtPayment, syncDebtsForTransactionChange } from "./debt-sync";

const paramsSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  type: CategoryKind.optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function serialize<T extends { amount: Prisma.Decimal }>(transaction: T) {
  return { ...transaction, amount: Number(transaction.amount) };
}

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) return reply.badRequest(query.error.message);

    const { type, categoryId, accountId, from, to } = query.data;

    const transactions = await app.prisma.transaction.findMany({
      where: {
        userId: request.user.userId,
        ...(type ? { type } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(accountId ? { accountId } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      orderBy: { date: "desc" },
      include: { category: true, account: true },
    });

    return transactions.map(serialize);
  });

  app.get("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const transaction = await app.prisma.transaction.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
      include: { category: true, account: true },
    });
    if (!transaction) return reply.notFound("Transaction not found");

    return serialize(transaction);
  });

  // Lançar uma transação numa categoria vinculada a uma dívida (Category.debtId)
  // desconta o valor de Debt.remainingAmount automaticamente (ver ./debt-sync).
  app.post("/", async (request, reply) => {
    const body = transactionCreateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const { accountId, categoryId, ...data } = body.data;

    const [account, category] = await Promise.all([
      app.prisma.account.findFirst({ where: { id: accountId, userId: request.user.userId } }),
      app.prisma.category.findFirst({ where: { id: categoryId, userId: request.user.userId } }),
    ]);
    if (!account) return reply.badRequest("Invalid accountId");
    if (!category) return reply.badRequest("Invalid categoryId");

    const transaction = await app.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: { ...data, accountId, categoryId, userId: request.user.userId },
        include: { category: true, account: true },
      });

      if (category.debtId) {
        await applyDebtPayment(tx, category.debtId, data.amount);
      }

      return created;
    });

    return reply.code(201).send(serialize(transaction));
  });

  app.patch("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const body = transactionUpdateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const existing = await app.prisma.transaction.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
      include: { category: true },
    });
    if (!existing) return reply.notFound("Transaction not found");

    const { accountId, categoryId, ...data } = body.data;

    if (accountId) {
      const account = await app.prisma.account.findFirst({
        where: { id: accountId, userId: request.user.userId },
      });
      if (!account) return reply.badRequest("Invalid accountId");
    }

    let newCategory = existing.category;
    if (categoryId && categoryId !== existing.categoryId) {
      const category = await app.prisma.category.findFirst({
        where: { id: categoryId, userId: request.user.userId },
      });
      if (!category) return reply.badRequest("Invalid categoryId");
      newCategory = category;
    }

    const newAmount = data.amount ?? Number(existing.amount);

    const transaction = await app.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(accountId ? { accountId } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
        include: { category: true, account: true },
      });

      await syncDebtsForTransactionChange(
        tx,
        { debtId: existing.category.debtId, amount: Number(existing.amount) },
        { debtId: newCategory.debtId, amount: newAmount },
      );

      return updated;
    });

    return serialize(transaction);
  });

  app.delete("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const existing = await app.prisma.transaction.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
      include: { category: true },
    });
    if (!existing) return reply.notFound("Transaction not found");

    await app.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: existing.id } });

      if (existing.category.debtId) {
        await reverseDebtPayment(tx, existing.category.debtId, Number(existing.amount));
      }
    });

    return reply.code(204).send();
  });
};
