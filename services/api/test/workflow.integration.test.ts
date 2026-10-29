import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { Auth } from "../src/auth/service.ts";
import { AppConfig } from "../src/config.ts";
import { DatabaseLive } from "../src/database/client.ts";
import { Routes } from "../src/http/routes.ts";

const createHandler = () =>
  HttpRouter.toWebHandler(
    Routes.pipe(
      HttpRouter.provideRequest(Layer.merge(DatabaseLive, Auth.layer)),
      Layer.provide(AppConfig.layer),
    ),
    { disableLogger: true },
  );
let app: ReturnType<typeof createHandler>;
beforeAll(() => {
  app = createHandler();
});
afterAll(async () => app.dispose());

function post(body: unknown, origin = "http://127.0.0.1:5173") {
  return app.handler(
    new Request("http://127.0.0.1:4310/api/workflow/inspect", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
  );
}

describe("workflow authorization and source boundaries", () => {
  it("rejects an untrusted origin even for explicit research", async () => {
    const response = await post(
      { url: "https://localhost/", researchOnly: true },
      "https://untrusted.invalid",
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("requires an account for personal workspace operations", async () => {
    const response = await post({
      url: "https://localhost/",
      researchOnly: false,
    });
    expect(response.status).toBe(401);
  });

  it("requires an explicit research declaration", async () => {
    expect((await post({ url: "https://localhost/" })).status).toBe(400);
  });

  it("does not fetch loopback URLs in research mode", async () => {
    const response = await post({
      url: "https://127.0.0.1/",
      researchOnly: true,
    });
    expect(response.ok).toBe(false);
    expect(await response.json()).toEqual({
      error:
        "Use a public HTTPS employer URL without credentials or an IP address.",
    });
  });

  it("does not expose execution or approval endpoints", async () => {
    for (const operation of ["submit", "approve", "fill", "upload"]) {
      const response = await app.handler(
        new Request(`http://127.0.0.1:4310/api/workflow/${operation}`, {
          method: "POST",
          headers: { origin: "http://127.0.0.1:5173" },
        }),
      );
      expect(response.status).toBe(404);
    }
  });
});
