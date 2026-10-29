import { ByteSize, Data, Effect, Layer, Schema } from "effect";
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import {
  PlanInput,
  DiscoverInput,
  InspectInput,
  AssessInput,
  RequirementsInput,
  PrepareInput,
} from "@applyatease/contracts/workflow";
import { AppConfig } from "../config.ts";
import { Auth } from "../auth/service.ts";
import { plan, discover, assess, requirements, prepare } from "./operations.ts";
import { captureSource } from "./source.ts";
import { analysisCapability } from "../analysis/codex.ts";
class WorkflowFailure extends Data.TaggedError("WorkflowFailure")<{
  message: string;
}> {}
function operation<S extends Schema.Top & Schema.ConstraintDecoder<unknown>>(
  schema: S,
  run: (input: S["Type"], signal: AbortSignal) => Promise<unknown>,
) {
  return Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const config = yield* AppConfig;
    const json = (value: unknown, status = 200) =>
      HttpServerResponse.jsonUnsafe(value, {
        status,
        headers: { "cache-control": "no-store" },
      });
    if (
      !["127.0.0.1", "localhost", "::1"].includes(config.host) ||
      !request.headers.origin ||
      (!config.origins.includes(request.headers.origin) &&
        request.headers.origin !== "app://app")
    )
      return json(
        { error: "Workflow operations require the configured local app." },
        403,
      );
    if (!request.headers["content-type"]?.startsWith("application/json"))
      return json({ error: "Expected JSON." }, 415);
    const raw = yield* request.text.pipe(
      Effect.provideService(
        HttpIncomingMessage.MaxBodySize,
        ByteSize.bytes(1800000),
      ),
    );
    const decoded = yield* Effect.result(
      Effect.try(() => JSON.parse(raw) as unknown).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(schema)),
      ),
    );
    if (decoded._tag === "Failure")
      return json(
        {
          error:
            "Invalid workflow input. Refresh the application and try again.",
        },
        400,
      );
    const input = decoded.success;
    const value = input as {
      profile?: { researchOnly?: boolean };
      researchOnly?: boolean;
    };
    const research =
      value.profile?.researchOnly === true || value.researchOnly === true;
    if (!research) {
      const auth = yield* Auth;
      const session = yield* Effect.tryPromise(() =>
        auth.api.getSession({ headers: new Headers(request.headers) }),
      );
      if (!session)
        return json(
          {
            error:
              "Sign in to use your personal opportunity workspace, or explicitly select local research mode.",
          },
          401,
        );
    }
    const result = yield* Effect.tryPromise({
      try: (signal) => run(input, signal),
      catch: (error) =>
        new WorkflowFailure({
          message:
            error instanceof Error
              ? error.message
              : "Workflow operation failed.",
        }),
    });
    return json(result);
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(
        HttpServerResponse.jsonUnsafe(
          {
            error:
              error instanceof Error
                ? error.message
                : "Workflow failed. Saved evidence is preserved; retry this operation.",
          },
          { status: 503, headers: { "cache-control": "no-store" } },
        ),
      ),
    ),
  );
}
export const WorkflowRoutes = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const bind = <S extends Schema.Top & Schema.ConstraintDecoder<unknown>>(
      schema: S,
      run: (input: S["Type"], signal: AbortSignal) => Promise<unknown>,
    ) => operation(schema, run).pipe(Effect.provideService(AppConfig, config));
    return Layer.mergeAll(
      HttpRouter.add(
        "GET",
        "/api/workflow/capability",
        Effect.tryPromise(analysisCapability).pipe(
          Effect.map((value) =>
            HttpServerResponse.jsonUnsafe(
              {
                ...value,
                operations: [
                  "plan",
                  "discover",
                  "inspect",
                  "assess",
                  "requirements",
                  "prepare",
                ],
                execution: false,
                formInspection: "static_partial",
                cvEditing: "exact_edit_plan",
              },
              { headers: { "cache-control": "no-store" } },
            ),
          ),
        ),
      ),
      HttpRouter.add(
        "POST",
        "/api/workflow/plan",
        bind(PlanInput, (input, signal) => plan(input.profile, signal)),
      ),
      HttpRouter.add(
        "POST",
        "/api/workflow/discover",
        bind(DiscoverInput, (input, signal) =>
          discover(input.profile, input.plan, signal),
        ),
      ),
      HttpRouter.add(
        "POST",
        "/api/workflow/inspect",
        bind(InspectInput, (input, signal) => captureSource(input.url, signal)),
      ),
      HttpRouter.add(
        "POST",
        "/api/workflow/assess",
        bind(AssessInput, (input, signal) =>
          assess(input.profile, input.job, signal),
        ),
      ),
      HttpRouter.add(
        "POST",
        "/api/workflow/requirements",
        bind(RequirementsInput, (input, signal) =>
          requirements(input.url, signal),
        ),
      ),
      HttpRouter.add(
        "POST",
        "/api/workflow/prepare",
        bind(PrepareInput, (input, signal) =>
          prepare(
            input.profile,
            input.job,
            input.form,
            input.requirements,
            signal,
          ),
        ),
      ),
    );
  }),
);
