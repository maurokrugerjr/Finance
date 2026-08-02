import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";

import prismaPlugin from "./plugins/prisma";
import authPlugin from "./plugins/auth";

import { healthRoutes } from "./modules/health/routes";
import { authRoutes } from "./modules/auth/routes";
import { categoryRoutes } from "./modules/categories/routes";
import { transactionRoutes } from "./modules/transactions/routes";
import { debtRoutes } from "./modules/debts/routes";
import { goalRoutes } from "./modules/goals/routes";

const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

export async function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  const allowedOrigins = (process.env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(helmet);
  await app.register(cors, { origin: allowedOrigins });
  await app.register(sensible);
  await app.register(rateLimit, { global: false });
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(categoryRoutes, { prefix: "/categories" });
  await app.register(transactionRoutes, { prefix: "/transactions" });
  await app.register(debtRoutes, { prefix: "/debts" });
  await app.register(goalRoutes, { prefix: "/goals" });

  return app;
}
