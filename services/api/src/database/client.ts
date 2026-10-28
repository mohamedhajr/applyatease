import { PgClient } from "@effect/sql-pg";
import { Effect, Layer } from "effect";
import { AppConfig } from "../config.ts";

export const DatabaseLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return PgClient.layer({
      url: config.databaseUrl,
      connectTimeout: "5 seconds",
      applicationName: "applyatease",
    });
  }),
);
