import { execSync } from "node:child_process";
import path from "node:path";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("finance_test")
    .withUsername("finance")
    .withPassword("finance")
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = "test-secret";
  process.env.CORS_ORIGIN = "http://localhost:3000";
  // Alto o suficiente para não interferir com os testes funcionais; o teste
  // de rate limit dedicado usa sua própria instância de app com um valor
  // baixo específico para exercitar o comportamento de throttling.
  process.env.AUTH_RATE_LIMIT_MAX = "1000";

  execSync("pnpm exec prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export async function teardown() {
  await container?.stop();
}
