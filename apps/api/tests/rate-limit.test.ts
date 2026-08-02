import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

// Este teste usa uma instância de app isolada (não a compartilhada em
// helpers.ts) porque precisa de um limite de rate limit baixo o suficiente
// para estourar em poucas requisições, sem afetar os demais arquivos de
// teste que compartilham a mesma instância/contadores.
describe("auth rate limiting", () => {
  let app: FastifyInstance;
  const previousMax = process.env.AUTH_RATE_LIMIT_MAX;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_MAX = "3";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    process.env.AUTH_RATE_LIMIT_MAX = previousMax;
    await app.close();
  });

  it("returns 429 after exceeding the configured limit for /auth/login", async () => {
    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "someone@example.com", password: "wrongpassword" },
      });

    const first = await attempt();
    const second = await attempt();
    const third = await attempt();
    const fourth = await attempt();

    expect(first.statusCode).toBe(401);
    expect(second.statusCode).toBe(401);
    expect(third.statusCode).toBe(401);
    expect(fourth.statusCode).toBe(429);
  });
});
