import { betterAuth, type BetterAuthOptions } from "better-auth";
import { Context, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";
import { AppConfig } from "../config.ts";

const makeOptions = Effect.gen(function* () {
  const config = yield* AppConfig;
  const database = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Pool({
          connectionString: Redacted.value(config.databaseUrl),
          max: 5,
          connectionTimeoutMillis: 5000,
        }),
    ),
    (pool) => Effect.promise(() => pool.end()),
  );
  return {
    appName: "Apply at Ease",
    database,
    secret: Redacted.value(config.authSecret),
    baseURL: config.authUrl.href,
    basePath: "/api/auth",
    trustedOrigins: config.origins,
    logger: { disabled: true },
  } satisfies BetterAuthOptions;
});

export class AuthOptions extends Context.Service<
  AuthOptions,
  Effect.Success<typeof makeOptions>
>()("applyatease/AuthOptions") {
  static readonly layer = Layer.effect(this, makeOptions);
}

const makeAuth = Effect.gen(function* () {
  const options = yield* AuthOptions;
  const auth = betterAuth(options);
  const context = yield* Effect.tryPromise(() => auth.$context);
  yield* Effect.tryPromise(async () => {
    await context.checkSchema?.();
  });
  return auth;
});

export class Auth extends Context.Service<
  Auth,
  Effect.Success<typeof makeAuth>
>()("applyatease/Auth") {
  static readonly layer = Layer.effect(this, makeAuth).pipe(
    Layer.provide(AuthOptions.layer),
  );
}
