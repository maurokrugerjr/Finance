import { describe, expect, it } from "vitest";
import { DEFAULT_SECRET, resolveJwtSecret } from "../src/plugins/auth";

const STRONG_SECRET = "a".repeat(32);

describe("resolveJwtSecret", () => {
  it("accepts the default secret only in development and test", () => {
    expect(resolveJwtSecret({ NODE_ENV: "development" })).toBe(DEFAULT_SECRET);
    expect(resolveJwtSecret({ NODE_ENV: "test" })).toBe(DEFAULT_SECRET);
  });

  it("refuses the default secret in production and when NODE_ENV is undefined", () => {
    expect(() => resolveJwtSecret({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret({})).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret({ JWT_SECRET: DEFAULT_SECRET })).toThrow(/JWT_SECRET/);
  });

  it("treats an empty JWT_SECRET as missing", () => {
    expect(() => resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("refuses a short secret outside development/test", () => {
    expect(() => resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "short-secret" })).toThrow(
      /at least 32/,
    );
  });

  it("accepts a strong secret in production", () => {
    expect(resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: STRONG_SECRET })).toBe(STRONG_SECRET);
  });
});
