import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { Auth, AuthOptions } from "../src/auth/service.ts";
import { AppConfig } from "../src/config.ts";
import { DatabaseLive } from "../src/database/client.ts";
import { Routes } from "../src/http/routes.ts";

const createHandler = () =>
  HttpRouter.toWebHandler(
    Routes.pipe(
      HttpRouter.provideRequest(Layer.merge(DatabaseLive, Auth.layer)),
      Layer.provide(AppConfig.layer),
    ),
    { disableLogger: true },
  );

let app: ReturnType<typeof createHandler>;

beforeAll(async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const options = yield* AuthOptions;
      const plan = yield* Effect.tryPromise(() => getMigrations(options));
      yield* Effect.tryPromise(() => plan.runMigrations());
      const repeated = yield* Effect.tryPromise(() => getMigrations(options));
      expect(repeated.toBeCreated).toEqual([]);
      expect(repeated.toBeAdded).toEqual([]);
      expect(repeated.toBeAddedIndexes).toEqual([]);
      expect(repeated.schemaProblems).toEqual([]);
    }).pipe(
      Effect.provide(AuthOptions.layer.pipe(Layer.provide(AppConfig.layer))),
    ),
  );
  app = createHandler();
});
afterAll(() => app?.dispose());

describe("API with PostgreSQL", () => {
  it("checks the live database before reporting readiness", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/health/ready"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
  it("requires an authenticated session", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/session"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
  it("does not grant CORS access to an untrusted origin", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/health/live", {
        headers: { origin: "https://untrusted.invalid" },
      }),
    );
    const allowed = response.headers.get("access-control-allow-origin");
    expect(allowed).not.toBe("https://untrusted.invalid");
    expect(allowed).not.toBe("*");
  });
  it("allows the configured web origin", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/health/live", {
        headers: { origin: "http://127.0.0.1:5173" },
      }),
    );
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:5173",
    );
  });
});
