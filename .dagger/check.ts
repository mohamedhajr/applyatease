import { connect } from "@dagger.io/dagger";
import { randomBytes } from "node:crypto";

await connect(
  async (client) => {
    const password = randomBytes(24).toString("hex");
    const database = client
      .container()
      .from(
        "postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382",
      )
      .withEnvVariable("POSTGRES_DB", "applyatease_test")
      .withEnvVariable("POSTGRES_USER", "applyatease_test")
      .withSecretVariable(
        "POSTGRES_PASSWORD",
        client.setSecret("postgres-password", password),
      )
      .withExposedPort(5432)
      .asService();
    const source = client.host().directory(".", {
      include: [
        "apps/",
        "services/",
        "packages/",
        ".dagger/",
        ".github/",
        "*.json",
        "*.yaml",
        "*.ts",
        ".oxlintrc.json",
        ".prettierignore",
        ".gitignore",
        ".node-version",
        "README.md",
        "THIRD_PARTY_NOTICES.txt",
      ],
      exclude: [
        "**/node_modules",
        "**/dist",
        "**/out",
        "**/release",
        "**/.env*",
        "**/test-results",
        "**/playwright-report",
        "**/coverage",
      ],
    });
    await client
      .container()
      .from("node:26.12.1-bookworm-slim")
      .withExec(["npm", "install", "--global", "pnpm@12.16.1"])
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["pnpm", "install", "--frozen-lockfile"])
      .withExec(["pnpm", "check"])
      .withServiceBinding("db", database)
      .withSecretVariable(
        "DATABASE_URL",
        client.setSecret(
          "database-url",
          `postgresql://applyatease_test:${password}@db:5432/applyatease_test`,
        ),
      )
      .withSecretVariable(
        "AUTH_SECRET",
        client.setSecret("auth-secret", randomBytes(32).toString("hex")),
      )
      .withEnvVariable("AUTH_URL", "http://127.0.0.1:4310")
      .withEnvVariable("APP_ORIGINS", "http://127.0.0.1:5173")
      .withExec(["pnpm", "test:integration"])
      .withExec([
        "pnpm",
        "exec",
        "playwright",
        "install",
        "--with-deps",
        "chromium",
      ])
      .withExec(["pnpm", "test:web"])
      .sync();
  },
  { LogOutput: process.stderr },
);
