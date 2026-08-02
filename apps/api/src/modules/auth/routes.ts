import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { registerInput, loginInput } from "@finance/types";

const SALT_ROUNDS = 12;

// Hash válido de bcrypt sem senha real correspondente: usado para que
// bcrypt.compare() sempre rode, mesmo quando o e-mail não existe, evitando
// que a diferença de tempo de resposta revele se uma conta existe ou não.
const DUMMY_HASH = "$2a$12$qPfFl13O/gO86XYG7fHW6.5N0PIOOV.ni80cDvP/P/qo5SGXIwKPW";

function toPublicUser(user: { id: string; email: string; name: string | null; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Lido no momento do registro do plugin (não no import do módulo) para que
  // cada instância de app criada por buildApp() respeite o valor atual de
  // AUTH_RATE_LIMIT_MAX (os testes de rate limit ajustam essa variável).
  const authRateLimit = {
    config: {
      rateLimit: {
        max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
        timeWindow: "1 minute",
      },
    },
  };

  app.post("/register", authRateLimit, async (request, reply) => {
    const body = registerInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const { email, password, name } = body.data;

    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) return reply.conflict("Email already registered");

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await app.prisma.user.create({
      data: { email, passwordHash, name },
    });

    const token = app.jwt.sign({ userId: user.id });

    return reply.code(201).send({ user: toPublicUser(user), token });
  });

  app.post("/login", authRateLimit, async (request, reply) => {
    const body = loginInput.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.message);

    const { email, password } = body.data;

    const user = await app.prisma.user.findUnique({ where: { email } });
    const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !isValid) {
      return reply.unauthorized("Invalid email or password");
    }

    const token = app.jwt.sign({ userId: user.id });

    return reply.send({ user: toPublicUser(user), token });
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.userId },
    });
    if (!user) return reply.notFound("User not found");

    return toPublicUser(user);
  });
};
