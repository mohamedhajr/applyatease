import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { isTrustedLocation, resolveAsset } from "../src/main/security.ts";

describe("desktop trust boundary", () => {
  it("accepts only the application protocol or the exact development origin", () => {
    expect(isTrustedLocation("app://app/#/settings")).toBe(true);
    expect(isTrustedLocation("https://app/")).toBe(false);
    expect(isTrustedLocation("app://app.evil/")).toBe(false);
    expect(isTrustedLocation("app://user@app/")).toBe(false);
    expect(isTrustedLocation("not a URL")).toBe(false);
    expect(
      isTrustedLocation("http://127.0.0.1:5174/", "http://127.0.0.1:5174"),
    ).toBe(true);
    expect(
      isTrustedLocation("http://127.0.0.1:5175/", "http://127.0.0.1:5174"),
    ).toBe(false);
  });
  it("serves assets only inside the renderer directory", () => {
    const root = resolve("renderer");
    expect(resolveAsset(root, "app://app/")).toBe(resolve(root, "index.html"));
    expect(resolveAsset(root, "app://app/assets/main.js")).toBe(
      resolve(root, "assets/main.js"),
    );
    for (const url of [
      "app://app/%2e%2e%2fsecret",
      "app://app/%5c..%5csecret",
      "app://app/%00",
      "app://app/%zz",
      "file:///secret",
      "app://elsewhere/index.html",
    ]) {
      expect(resolveAsset(root, url)).toBeUndefined();
    }
  });
});
