import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/db", async () => {
    await app.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", database: "connected" };
  });
};
