import { Schema } from "effect";

export const DesktopRuntime = Schema.Struct({
  platform: Schema.Literals(["darwin", "win32", "linux"]),
  node: Schema.String,
  appVersion: Schema.String,
});
export type DesktopRuntime = typeof DesktopRuntime.Type;

export const WorkerRequest = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("runtime"),
});
export const WorkerResponse = Schema.Struct({
  id: Schema.String,
  runtime: DesktopRuntime,
});

export interface DesktopBridge {
  readonly getRuntime: () => Promise<DesktopRuntime>;
}
