import { NodeRuntime } from "@effect/platform-node";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Layer } from "effect";
import { AuthOptions } from "../auth/service.ts";
import { AppConfig } from "../config.ts";

const migrate = Effect.gen(function* () {
  const options = yield* AuthOptions;
  const plan = yield* Effect.tryPromise(() => getMigrations(options));
  yield* Effect.tryPromise(() => plan.runMigrations());
  yield* Effect.logInfo("Database migrations complete");
});

NodeRuntime.runMain(
  migrate.pipe(
    Effect.provide(AuthOptions.layer.pipe(Layer.provide(AppConfig.layer))),
  ),
);
