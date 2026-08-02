import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { goalCreateInput, goalUpdateInput, goalContributionCreateInput } from "@finance/types";

const paramsSchema = z.object({ id: z.string().uuid() });
const contributionParamsSchema = z.object({
  id: z.string().uuid(),
  contributionId: z.string().uuid(),
});

function serializeGoal<T extends { targetAmount: Prisma.Decimal; currentAmount: Prisma.Decimal }>(
  goal: T,
) {
  return {
    ...goal,
    targetAmount: Number(goal.targetAmount),
    currentAmount: Number(goal.currentAmount),
  };
}

function serializeContribution<T extends { amount: Prisma.Decimal }>(contribution: T) {
  return { ...contribution, amount: Number(contribution.amount) };
}

export const goalRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const goals = await app.prisma.goal.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: "asc" },
    });
    return goals.map(serializeGoal);
  });

  app.get("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const goal = await app.prisma.goal.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!goal) return reply.notFound("Goal not found");

    return serializeGoal(goal);
  });

  app.post("/", async (request, reply) => {
    const body = goalCreateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const { currentAmount, ...rest } = body.data;

    const goal = await app.prisma.goal.create({
      data: { ...rest, currentAmount: currentAmount ?? 0, userId: request.user.userId },
    });

    return reply.code(201).send(serializeGoal(goal));
  });

  app.patch("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const body = goalUpdateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const existing = await app.prisma.goal.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!existing) return reply.notFound("Goal not found");

    const goal = await app.prisma.goal.update({
      where: { id: existing.id },
      data: body.data,
    });

    return serializeGoal(goal);
  });

  app.delete("/:id", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const existing = await app.prisma.goal.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!existing) return reply.notFound("Goal not found");

    await app.prisma.goal.delete({ where: { id: existing.id } });
    return reply.code(204).send();
  });

  app.get("/:id/contributions", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const goal = await app.prisma.goal.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!goal) return reply.notFound("Goal not found");

    const contributions = await app.prisma.goalContribution.findMany({
      where: { goalId: goal.id },
      orderBy: { date: "desc" },
    });

    return contributions.map(serializeContribution);
  });

  app.post("/:id/contributions", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const body = goalContributionCreateInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const goal = await app.prisma.goal.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!goal) return reply.notFound("Goal not found");

    const { amount, date } = body.data;
    const newCurrent = Number(goal.currentAmount) + amount;

    const [contribution, updatedGoal] = await app.prisma.$transaction([
      app.prisma.goalContribution.create({ data: { amount, date, goalId: goal.id } }),
      app.prisma.goal.update({ where: { id: goal.id }, data: { currentAmount: newCurrent } }),
    ]);

    return reply.code(201).send({
      contribution: serializeContribution(contribution),
      goal: serializeGoal(updatedGoal),
    });
  });

  app.delete("/:id/contributions/:contributionId", async (request, reply) => {
    const params = contributionParamsSchema.safeParse(request.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const goal = await app.prisma.goal.findFirst({
      where: { id: params.data.id, userId: request.user.userId },
    });
    if (!goal) return reply.notFound("Goal not found");

    const contribution = await app.prisma.goalContribution.findFirst({
      where: { id: params.data.contributionId, goalId: goal.id },
    });
    if (!contribution) return reply.notFound("Contribution not found");

    const restoredCurrent = Math.max(
      Number(goal.currentAmount) - Number(contribution.amount),
      0,
    );

    await app.prisma.$transaction([
      app.prisma.goalContribution.delete({ where: { id: contribution.id } }),
      app.prisma.goal.update({ where: { id: goal.id }, data: { currentAmount: restoredCurrent } }),
    ]);

    return reply.code(204).send();
  });
};
