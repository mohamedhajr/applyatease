import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { Auth, AuthOptions } from "../src/auth/service.ts";
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
const delivered = new Map<string, string>();
let database: Pool;
let testAddress = 0;
beforeEach(() => {
  testAddress += 1;
});
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
const post = (
  path: string,
  body: unknown,
  cookie = "",
  origin = "http://127.0.0.1:5173",
) =>
  app.handler(
    new Request(`http://127.0.0.1:4310/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        cookie,
        "x-forwarded-for": `192.0.2.${testAddress}`,
      },
      body: JSON.stringify(body),
    }),
  );
const accountEmail = () => `auth-test-${randomUUID()}@example.invalid`;
async function requestCode(email: string) {
  const response = await post("/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
  expect(response.status).toBe(200);
  const code = delivered.get(email);
  expect(code).toMatch(/^\d{6}$/);
  return code!;
}

beforeAll(async () => {
  vi.stubEnv("RESEND_API_KEY", "test-transport-only");
  vi.stubEnv("AUTH_EMAIL_FROM", "signin@example.invalid");
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
  vi.stubEnv("APPLE_CLIENT_ID", "");
  vi.stubEnv("APPLE_CLIENT_SECRET", "");
  const nativeFetch = globalThis.fetch;
  // Only delivery is captured; codes, sessions and PKCE use the real auth service.
  vi.stubGlobal(
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url !== "https://api.resend.com/emails")
        return nativeFetch(input, init);
      if (typeof init?.body !== "string")
        throw new Error("Expected a JSON email request");
      const message = JSON.parse(init.body) as {
        to: string[];
        text: string;
      };
      const address = message.to[0]!;
      if (!address.endsWith("@example.invalid"))
        throw new Error("Only test recipients are allowed");
      delivered.set(address, message.text.match(/\b\d{6}\b/)![0]);
      return Response.json({ id: "captured-test-delivery" });
    },
  );
  database = new Pool({ connectionString: process.env.DATABASE_URL });
  await Effect.runPromise(
    Effect.gen(function* () {
      const options = yield* AuthOptions;
      const plan = yield* Effect.tryPromise(() => getMigrations(options));
      yield* Effect.tryPromise(() => plan.runMigrations());
      const repeated = yield* Effect.tryPromise(() => getMigrations(options));
      expect(repeated.toBeCreated).toEqual([]);
      expect(repeated.toBeAdded).toEqual([]);
      expect(repeated.toBeAddedIndexes).toEqual([]);
      expect(repeated.schemaProblems).toEqual([]);
    }).pipe(
      Effect.provide(AuthOptions.layer.pipe(Layer.provide(AppConfig.layer))),
    ),
  );
  app = createHandler();
});
afterAll(async () => {
  await app?.dispose();
  await database?.end();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("API with PostgreSQL", () => {
  it("checks the live database before reporting readiness", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/health/ready"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
  it("requires an authenticated session", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/session"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
  it("does not grant CORS access to an untrusted origin", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/health/live", {
        headers: { origin: "https://untrusted.invalid" },
      }),
    );
    const allowed = response.headers.get("access-control-allow-origin");
    expect(allowed).not.toBe("https://untrusted.invalid");
    expect(allowed).not.toBe("*");
  });
  it("allows the configured web origin", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/health/live", {
        headers: { origin: "http://127.0.0.1:5173" },
      }),
    );
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:5173",
    );
  });
});

describe("email-code and desktop authentication", () => {
  it("exposes provider availability without credentials", async () => {
    const response = await app.handler(
      new Request("http://127.0.0.1:4310/api/auth-options"),
    );
    expect(await response.json()).toEqual({
      email: true,
      google: false,
      apple: false,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("hashes codes, rejects wrong codes and replay, and revokes a session on sign-out", async () => {
    const email = accountEmail();
    const otp = await requestCode(email);
    const stored = await database.query<{ value: string }>(
      "SELECT value FROM verification WHERE identifier LIKE $1",
      [`%${email}%`],
    );
    expect(stored.rows.length).toBeGreaterThan(0);
    expect(stored.rows.every((row) => !row.value.includes(otp))).toBe(true);
    const wrong = otp === "000000" ? "111111" : "000000";
    expect((await post("/sign-in/email-otp", { email, otp: wrong })).ok).toBe(
      false,
    );
    const signedIn = await post("/sign-in/email-otp", { email, otp });
    expect(signedIn.status).toBe(200);
    const cookie = cookies(signedIn);
    expect(cookie).toContain("session_token=");
    const session = await app.handler(
      new Request("http://127.0.0.1:4310/api/session", { headers: { cookie } }),
    );
    expect(session.status).toBe(200);
    const value = (await session.json()) as {
      user: { email: string };
      session?: unknown;
    };
    expect(value.user.email).toBe(email);
    expect(value.session).toBeUndefined();
    expect((await post("/sign-in/email-otp", { email, otp })).ok).toBe(false);
    expect((await post("/sign-out", {}, cookie)).ok).toBe(true);
    const revoked = await app.handler(
      new Request("http://127.0.0.1:4310/api/session", { headers: { cookie } }),
    );
    expect(revoked.status).toBe(401);
  });
  it("rejects expired codes and untrusted sign-in origins", async () => {
    const email = accountEmail();
    const otp = await requestCode(email);
    await database.query(
      `UPDATE verification SET "expiresAt" = NOW() - interval '1 minute' WHERE identifier LIKE $1`,
      [`%${email}%`],
    );
    expect((await post("/sign-in/email-otp", { email, otp })).ok).toBe(false);
    expect(
      (
        await post(
          "/email-otp/send-verification-otp",
          { email, type: "sign-in" },
          "",
          "https://untrusted.invalid",
        )
      ).status,
    ).toBe(403);
  });
  it("requires the desktop PKCE verifier and consumes each handoff once", async () => {
    const email = accountEmail();
    const otp = await requestCode(email);
    const signedIn = await post("/sign-in/email-otp", { email, otp });
    const cookie = cookies(signedIn);
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(16).toString("hex");
    const query = new URLSearchParams({
      client_id: "electron",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    });
    async function transfer() {
      const response = await post(
        `/electron/transfer-user?${query}`,
        {},
        cookie,
      );
      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        electron_authorization_code: string;
      };
      expect(data.electron_authorization_code).toBeTruthy();
      return data.electron_authorization_code;
    }
    const stolen = await transfer();
    expect(
      (
        await post(
          "/electron/token",
          { token: stolen, state, code_verifier: "wrong-verifier" },
          "",
          "com.applyatease.app:/",
        )
      ).ok,
    ).toBe(false);
    const token = await transfer();
    const exchange = await post(
      "/electron/token",
      { token, state, code_verifier: verifier },
      "",
      "com.applyatease.app:/",
    );
    expect(exchange.status).toBe(200);
    const desktopCookie = cookies(exchange);
    const current = await app.handler(
      new Request("http://127.0.0.1:4310/api/session", {
        headers: { cookie: desktopCookie },
      }),
    );
    expect(current.status).toBe(200);
    expect(
      (
        await post(
          "/electron/token",
          { token, state, code_verifier: verifier },
          "",
          "com.applyatease.app:/",
        )
      ).ok,
    ).toBe(false);
  });
});

it("limits repeated code requests from one client", async () => {
  const email = accountEmail();
  for (let attempt = 0; attempt < 3; attempt++) await requestCode(email);
  expect(
    (await post("/email-otp/send-verification-otp", { email, type: "sign-in" }))
      .status,
  ).toBe(429);
});
it("locks a code after five wrong verification attempts", async () => {
  const email = accountEmail();
  const otp = await requestCode(email);
  for (let attempt = 0; attempt < 5; attempt++) {
    testAddress += 1;
    const response = await post("/sign-in/email-otp", {
      email,
      otp: otp === "000000" ? "111111" : "000000",
    });
    expect(response.ok).toBe(false);
  }
  // A different IP avoids confusing the code's attempt limit with the request limit.
  testAddress += 1;
  expect((await post("/sign-in/email-otp", { email, otp })).ok).toBe(false);
});
