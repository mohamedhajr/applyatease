import { Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { SqlClient } from "effect/sql";
import { Auth } from "../auth/service.ts";
import { AnalysisRoutes } from "../analysis/routes.ts";
import { WorkflowRoutes } from "../workflow/routes.ts";
import { AppConfig } from "../config.ts";

const unavailable = HttpServerResponse.jsonUnsafe(
  { status: "unavailable" },
  { status: 503 },
);
const ready = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`select 1`;
  return HttpServerResponse.jsonUnsafe({ status: "ok" });
}).pipe(
  Effect.timeout("3 seconds"),
  Effect.orElseSucceed(() => unavailable),
);

const authentication = Effect.gen(function* () {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (
    request.method !== "GET" &&
    request.method !== "OPTIONS" &&
    (!request.headers.origin ||
      !auth.options.trustedOrigins.includes(request.headers.origin))
  ) {
    return HttpServerResponse.jsonUnsafe(
      { error: "untrusted_origin" },
      { status: 403 },
    );
  }
  const web = yield* HttpServerRequest.toWeb(request);
  const response = yield* Effect.tryPromise(() => auth.handler(web));
  return HttpServerResponse.fromWeb(response);
}).pipe(Effect.orElseSucceed(() => unavailable));

const session = Effect.gen(function* () {
  const auth = yield* Auth;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const current = yield* Effect.tryPromise(() =>
    auth.api.getSession({ headers: new Headers(request.headers) }),
  );
  if (!current)
    return HttpServerResponse.jsonUnsafe(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  return HttpServerResponse.jsonUnsafe(
    {
      user: {
        id: current.user.id,
        name: current.user.name,
        email: current.user.email,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}).pipe(Effect.orElseSucceed(() => unavailable));

export const Routes = Layer.mergeAll(
  AnalysisRoutes,
  WorkflowRoutes,
  Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      return HttpRouter.add(
        "GET",
        "/api/auth-options",
        HttpServerResponse.jsonUnsafe(
          {
            email: Boolean(
              Redacted.value(config.resendKey) && config.emailFrom,
            ),
            google: Boolean(
              config.googleClientId &&
              Redacted.value(config.googleClientSecret),
            ),
            apple: Boolean(
              config.appleClientId && Redacted.value(config.appleClientSecret),
            ),
          },
          { headers: { "cache-control": "no-store" } },
        ),
      );
    }),
  ),
  HttpRouter.add(
    "GET",
    "/api/health/live",
    HttpServerResponse.jsonUnsafe({ status: "ok" }),
  ),
  HttpRouter.add("GET", "/api/health/ready", ready),
  HttpRouter.add("*", "/api/auth/*", authentication),
  HttpRouter.add("GET", "/api/session", session),
  Layer.unwrap(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      return HttpRouter.cors({
        allowedOrigins: config.origins,
        allowedMethods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["content-type"],
        credentials: true,
      });
    }),
  ),
);
