import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { getTestApp, resetDatabase, registerUser, uniqueEmail } from "./helpers";

describe("auth", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  describe("POST /auth/register", () => {
    it("creates a user and returns a token without leaking the password hash", async () => {
      const email = uniqueEmail();
      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "supersecret123", name: "Mauro" },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.user).toMatchObject({ email, name: "Mauro" });
      expect(body.user.passwordHash).toBeUndefined();
      expect(typeof body.token).toBe("string");
    });

    it("rejects a duplicate email with 409", async () => {
      const email = uniqueEmail();
      await registerUser(app, { email });

      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "anotherpassword123" },
      });

      expect(res.statusCode).toBe(409);
    });

    it("rejects a password shorter than 8 characters", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: uniqueEmail(), password: "123" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects an invalid email format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email: "not-an-email", password: "supersecret123" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("logs in with correct credentials", async () => {
      const email = uniqueEmail();
      await registerUser(app, { email, password: "supersecret123" });

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "supersecret123" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.email).toBe(email);
      expect(typeof body.token).toBe("string");
    });

    it("rejects a wrong password with a generic message", async () => {
      const email = uniqueEmail();
      await registerUser(app, { email, password: "supersecret123" });

      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "wrongpassword" },
      });

      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.payload).message).toBe("Invalid email or password");
    });

    it("rejects a nonexistent email with the same generic message (no user enumeration)", async () => {
      const wrongPasswordRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: uniqueEmail(), password: "supersecret123" },
      });
      const nonexistentRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "nobody-here@example.com", password: "whatever123" },
      });

      expect(wrongPasswordRes.statusCode).toBe(401);
      expect(nonexistentRes.statusCode).toBe(401);
      expect(JSON.parse(nonexistentRes.payload).message).toBe(
        JSON.parse(wrongPasswordRes.payload).message,
      );
    });
  });

  describe("GET /auth/me", () => {
    it("returns the current user when authenticated", async () => {
      const { authHeader, email } = await registerUser(app);

      const res = await app.inject({ method: "GET", url: "/auth/me", headers: authHeader });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).email).toBe(email);
    });

    it("rejects requests without a token", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/me" });
      expect(res.statusCode).toBe(401);
    });

    it("rejects requests with a malformed token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: "Bearer not-a-valid-token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
