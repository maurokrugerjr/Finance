import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp } from "./helpers";

describe("health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toMatchObject({ status: "ok" });
  });

  it("GET /health/db confirms the database connection", async () => {
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ status: "ok", database: "connected" });
  });
});
