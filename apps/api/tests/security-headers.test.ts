import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp } from "./helpers";

describe("security headers", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  it("sets helmet security headers", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("reflects Access-Control-Allow-Origin for the configured web origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:3000" },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("does not reflect Access-Control-Allow-Origin for a disallowed origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil-site.example" },
    });

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
