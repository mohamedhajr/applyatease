import { getMigrations } from "better-auth/db/migration";
import { Effect, Layer } from "effect";
import { AuthOptions } from "../src/auth/service.ts";
import { AppConfig } from "../src/config.ts";

export default async function setup() {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const options = yield* AuthOptions;
        const migrations = yield* Effect.tryPromise(() =>
          getMigrations(options),
        );
        yield* Effect.tryPromise(() => migrations.runMigrations());
      }).pipe(
        Effect.provide(AuthOptions.layer.pipe(Layer.provide(AppConfig.layer))),
      ),
    ),
  );
}
