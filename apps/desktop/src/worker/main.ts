import { DesktopRuntime, WorkerRequest } from "@applyatease/contracts/desktop";
import { Config, Effect, Schema } from "effect";

const getRuntime = Effect.fn("Desktop.getRuntime")(function* (
  message: unknown,
) {
  const request = yield* Schema.decodeUnknownEffect(WorkerRequest)(message);
  const appVersion = yield* Config.NonEmptyString("APP_VERSION");
  const runtime = yield* Schema.decodeUnknownEffect(DesktopRuntime)({
    platform: process.platform,
    node: process.versions.node,
    appVersion,
  });
  return { id: request.id, runtime };
});

process.parentPort?.on("message", ({ data }: { data: unknown }) => {
  void Effect.runPromise(getRuntime(data)).then(
    (response) => process.parentPort?.postMessage(response),
    () => process.exit(1),
  );
});
