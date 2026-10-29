import type { AuthCapabilities, AuthUser } from "./auth.ts";
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
  readonly getAuthCapabilities: () => Promise<AuthCapabilities>;
  readonly getAuthUser: () => Promise<AuthUser | null>;
  readonly requestAuth: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly onAuthChanged: (callback: (error?: string) => void) => () => void;
  readonly getRuntime: () => Promise<DesktopRuntime>;
}
