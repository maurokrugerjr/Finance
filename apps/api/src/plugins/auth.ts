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
    // tokenVersion precisa bater com User.tokenVersion; logout incrementa o
    // valor no banco e com isso invalida todos os tokens emitidos antes.
    payload: { userId: string; tokenVersion: number };
  }
}

export const DEFAULT_SECRET = "change-me-to-a-random-secret";
const MIN_SECRET_LENGTH = 32;
const RELAXED_ENVS = new Set(["development", "test"]);

// O segredo padrão está no repositório, então quem o conhece consegue forjar
// tokens. Ele só é aceito com NODE_ENV explicitamente development/test; em
// qualquer outro caso (inclusive NODE_ENV indefinido) exige um segredo real.
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.JWT_SECRET || DEFAULT_SECRET;
  if (RELAXED_ENVS.has(env.NODE_ENV ?? "")) return secret;

  if (secret === DEFAULT_SECRET || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters ` +
        `(NODE_ENV=${env.NODE_ENV ?? "undefined"})`,
    );
  }
  return secret;
}

const authPlugin: FastifyPluginAsync = fp(async (app) => {
  await app.register(jwt, {
    secret: resolveJwtSecret(),
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.unauthorized("Invalid or missing token");
    }

    const user = await app.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== request.user.tokenVersion) {
      return reply.unauthorized("Invalid or missing token");
    }
  });
});

export default authPlugin;
