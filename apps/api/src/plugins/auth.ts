import fp from "fastify-plugin";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string };
  }
}

const DEFAULT_SECRET = "change-me-to-a-random-secret";

const authPlugin: FastifyPluginAsync = fp(async (app) => {
  const secret = process.env.JWT_SECRET ?? DEFAULT_SECRET;

  if (process.env.NODE_ENV === "production" && secret === DEFAULT_SECRET) {
    throw new Error("JWT_SECRET must be set to a real secret in production");
  }

  await app.register(jwt, {
    secret,
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.unauthorized("Invalid or missing token");
    }
  });
});

export default authPlugin;
