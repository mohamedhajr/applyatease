import { it, expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { WorkerRequest, WorkerResponse } from "../src/desktop.ts";

it.effect("rejects unsupported worker operations and malformed replies", () =>
  Effect.gen(function* () {
    const operation = yield* Schema.decodeUnknownEffect(WorkerRequest)({
      id: "request",
      type: "execute",
    }).pipe(Effect.result);
    const response = yield* Schema.decodeUnknownEffect(WorkerResponse)({
      id: "request",
      runtime: { platform: "unknown" },
    }).pipe(Effect.result);
    expect(operation._tag).toBe("Failure");
    expect(response._tag).toBe("Failure");
  }),
);
