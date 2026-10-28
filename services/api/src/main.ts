import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { createServer } from "node:http";
import { Auth } from "./auth/service.ts";
import { AppConfig } from "./config.ts";
import { DatabaseLive } from "./database/client.ts";
import { Routes } from "./http/routes.ts";

const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return NodeHttpServer.layer(createServer, {
      host: config.host,
      port: config.port,
    });
  }),
);
const Application = HttpRouter.serve(Routes, { disableLogger: true }).pipe(
  Layer.provide([ServerLive, DatabaseLive, Auth.layer]),
  Layer.provide(AppConfig.layer),
);
NodeRuntime.runMain(Layer.launch(Application));
