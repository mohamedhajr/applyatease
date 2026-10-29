import { Config, Context, Layer, Redacted, Schema } from "effect";

const configuration = Config.all({
  host: Config.String("API_HOST").pipe(Config.withDefault("127.0.0.1")),
  port: Config.Port("API_PORT").pipe(Config.withDefault(4310)),
  databaseUrl: Config.Redacted("DATABASE_URL"),
  authSecret: Config.schema(
    Schema.Redacted(Schema.String.check(Schema.isMinLength(32))),
    "AUTH_SECRET",
  ),
  authUrl: Config.URL("AUTH_URL"),
  googleClientId: Config.String("GOOGLE_CLIENT_ID").pipe(
    Config.withDefault(""),
  ),
  googleClientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  appleClientId: Config.String("APPLE_CLIENT_ID").pipe(Config.withDefault("")),
  appleClientSecret: Config.Redacted("APPLE_CLIENT_SECRET").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  resendKey: Config.Redacted("RESEND_API_KEY").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  emailFrom: Config.String("AUTH_EMAIL_FROM").pipe(Config.withDefault("")),
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
