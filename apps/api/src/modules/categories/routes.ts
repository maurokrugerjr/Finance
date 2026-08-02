import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { categoryCreateInput, categoryUpdateInput, CategoryKind } from "@finance/types";

const paramsSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({ kind: CategoryKind.optional() });

// Um debtId só faz sentido em categorias de gasto, e precisa apontar para
// uma dívida do próprio usuário. Retorna uma mensagem de erro, ou null se ok.
async function validateDebtLink(
  app: FastifyInstance,
  userId: string,
  debtId: string | null | undefined,
  kind: CategoryKind,
): Promise<string | null> {
  if (debtId === undefined || debtId === null) return null;
  if (kind !== "EXPENSE") return "debtId can only be set on EXPENSE categories";

  const debt = await app.prisma.debt.findFirst({ where: { id: debtId, userId } });
  if (!debt) return "Invalid debtId";

  return null;
}

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) return reply.badRequest(query.error.message);

    return app.prisma.category.findMany({
      where: {
        userId: request.user.userId,
        ...(query.data.kind ? { kind: query.data.kind } : {}),
      },
      orderBy: { name: "asc" },
    });
  });

  app.get("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const category = await app.prisma.category.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!category) return reply.notFound("Category not found");

    return category;
  });

  app.post("/", async (request, reply) => {
    const body = categoryCreateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const debtLinkError = await validateDebtLink(
      app,
      request.user.userId,
      body.data.debtId,
      body.data.kind,
    );
    if (debtLinkError) return reply.badRequest(debtLinkError);

    try {
      const category = await app.prisma.category.create({
        data: { ...body.data, userId: request.user.userId },
      });
      return reply.code(201).send(category);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.conflict("A category with this name and kind already exists");
      }
      throw err;
    }
  });

  app.patch("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const body = categoryUpdateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const existing = await app.prisma.category.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!existing) return reply.notFound("Category not found");

    const effectiveKind = body.data.kind ?? existing.kind;
    const debtLinkError = await validateDebtLink(
      app,
      request.user.userId,
      body.data.debtId,
      effectiveKind,
    );
    if (debtLinkError) return reply.badRequest(debtLinkError);

    try {
      return await app.prisma.category.update({
        where: { id: existing.id },
        data: body.data,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.conflict("A category with this name and kind already exists");
      }
      throw err;
    }
  });

  app.delete("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const existing = await app.prisma.category.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!existing) return reply.notFound("Category not found");

    try {
      await app.prisma.category.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        return reply.conflict("Cannot delete a category that has transactions");
      }
      throw err;
    }
  });
};
