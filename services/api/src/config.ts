import { Config, Context, Layer, Schema } from "effect";

const configuration = Config.all({
  host: Config.String("API_HOST").pipe(Config.withDefault("127.0.0.1")),
  port: Config.Port("API_PORT").pipe(Config.withDefault(4310)),
  databaseUrl: Config.Redacted("DATABASE_URL"),
  authSecret: Config.schema(
    Schema.Redacted(Schema.String.check(Schema.isMinLength(32))),
    "AUTH_SECRET",
  ),
  authUrl: Config.URL("AUTH_URL"),
  origins: Config.NonEmptyString("APP_ORIGINS").pipe(
    Config.map((value) => value.split(",").map((origin) => origin.trim())),
  ),
});

export class AppConfig extends Context.Service<
  AppConfig,
  Config.Success<typeof configuration>
>()("applyatease/AppConfig") {
  static readonly layer = Layer.effect(this, configuration);
}
