import { WorkerResponse } from "@applyatease/contracts/desktop";
import type { DesktopRuntime } from "@applyatease/contracts/desktop";
import { Schema } from "effect";
import { utilityProcess } from "electron";
import { randomUUID } from "node:crypto";

export function startWorker(path: string, appVersion: string) {
  const worker = utilityProcess.fork(path, [], {
    serviceName: "Apply at Ease",
    env: { APP_VERSION: appVersion },
  });
  const pending = new Map<
    string,
    {
      resolve: (value: DesktopRuntime) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let stopped = false;
  const failAll = () => {
    stopped = true;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Desktop service stopped"));
    }
    pending.clear();
  };
  worker.on("exit", failAll);
  worker.on("message", (value: unknown) => {
    const decoded = Schema.decodeUnknownResult(WorkerResponse)(value);
    if (decoded._tag === "Failure") return;
    const request = pending.get(decoded.success.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(decoded.success.id);
    request.resolve(decoded.success.runtime);
  });
  return {
    getRuntime: (): Promise<DesktopRuntime> => {
      if (stopped)
        return Promise.reject(new Error("Desktop service is unavailable"));
      const id = randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Desktop service timed out"));
        }, 5000);
        pending.set(id, { resolve, reject, timer });
        worker.postMessage({ id, type: "runtime" });
      });
    },
    stop: () => {
      failAll();
      worker.kill();
    },
  };
}
