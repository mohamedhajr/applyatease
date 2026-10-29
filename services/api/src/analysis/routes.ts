import { ByteSize, Data, Effect, Layer, Schema } from "effect";
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import { AnalysisInput } from "@applyatease/contracts/career";
import { AppConfig } from "../config.ts";
import { analysisCapability, analyzeWithCodex } from "./codex.ts";

class AnalysisUnavailable extends Data.TaggedError("AnalysisUnavailable")<{
  message: string;
}> {}

const capability = Effect.tryPromise(analysisCapability).pipe(
  Effect.orElseSucceed(() => ({
    available: false,
    message: "Analysis connection unavailable.",
  })),
  Effect.map((value) =>
    HttpServerResponse.jsonUnsafe(value, {
      headers: { "cache-control": "no-store" },
    }),
  ),
);
const analyze = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const config = yield* AppConfig;
  const origin = request.headers.origin;
  if (
    !["127.0.0.1", "localhost", "::1"].includes(config.host) ||
    !origin ||
    (!config.origins.includes(origin) && origin !== "app://app")
  )
    return HttpServerResponse.jsonUnsafe(
      { error: "Analysis is available only from the configured local app." },
      { status: 403 },
    );
  if (!request.headers["content-type"]?.startsWith("application/json"))
    return HttpServerResponse.jsonUnsafe(
      { error: "Expected JSON source." },
      { status: 415 },
    );
  const raw = yield* request.text.pipe(
    Effect.provideService(
      HttpIncomingMessage.MaxBodySize,
      ByteSize.bytes(1200000),
    ),
  );
  if (raw.length > 1200000)
    return HttpServerResponse.jsonUnsafe(
      { error: "Source exceeds the analysis limit." },
      { status: 413 },
    );
  const decoded = yield* Effect.result(
    Effect.try(() => JSON.parse(raw) as unknown).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(AnalysisInput)),
    ),
  );
  if (decoded._tag === "Failure")
    return HttpServerResponse.jsonUnsafe(
      { error: "The CV source could not be read. Import the document again." },
      { status: 400 },
    );
  const source = decoded.success;
  const result = yield* Effect.tryPromise({
    try: () => analyzeWithCodex(source),
    catch: (error) =>
      new AnalysisUnavailable({
        message: error instanceof Error ? error.message : "Analysis failed.",
      }),
  });
  return HttpServerResponse.jsonUnsafe(result, {
    headers: { "cache-control": "no-store" },
  });
}).pipe(
  Effect.catch((error) =>
    Effect.succeed(
      HttpServerResponse.jsonUnsafe(
        {
          error:
            error instanceof Error
              ? error.message
              : "Analysis failed. Your CV is preserved.",
        },
        { status: 503 },
      ),
    ),
  ),
);
export const AnalysisRoutes = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return Layer.mergeAll(
      HttpRouter.add("GET", "/api/cv-analysis/capability", capability),
      HttpRouter.add(
        "POST",
        "/api/cv-analysis",
        analyze.pipe(Effect.provideService(AppConfig, config)),
      ),
    );
  }),
);
