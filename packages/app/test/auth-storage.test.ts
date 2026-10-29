import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { Effect } from "effect";
import { emptyProfile } from "../src/onboarding/model.ts";
import {
  claimOnboardingProfile,
  loadProfileFor,
  profileKey,
  saveProfile,
} from "../src/onboarding/storage.ts";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const confirmed = (date: string) => ({ ...emptyProfile(), confirmedAt: date });
const load = (key?: string) => Effect.runPromise(loadProfileFor(key));

describe("local profile ownership", () => {
  it("moves a completed guest draft only to the signed-in account", async () => {
    const profile = confirmed("2026-01-01T00:00:00.000Z");
    await Effect.runPromise(saveProfile(profile, null, 0));
    expect(await claimOnboardingProfile("account-a")).toBe("saved");
    expect((await load(profileKey("account-a"))).profile).toEqual(profile);
    expect((await load()).revision).toBe(0);
    expect((await load(profileKey("account-b"))).revision).toBe(0);
  });
  it("keeps both profiles until an explicit replacement choice", async () => {
    const previous = confirmed("2026-01-01T00:00:00.000Z");
    const next = confirmed("2026-01-02T00:00:00.000Z");
    await Effect.runPromise(
      saveProfile(previous, null, 0, profileKey("account-a")),
    );
    await Effect.runPromise(saveProfile(next, null, 0));
    expect(await claimOnboardingProfile("account-a")).toBe("conflict");
    expect((await load()).profile).toEqual(next);
    expect((await load(profileKey("account-a"))).profile).toEqual(previous);
    await claimOnboardingProfile("account-a", "saved");
    expect((await load(profileKey("account-a"))).profile).toEqual(previous);
    expect((await load()).revision).toBe(0);
  });
  it("replaces only the selected account and retains concurrent-write protection", async () => {
    const previous = confirmed("2026-01-01T00:00:00.000Z");
    const next = confirmed("2026-01-02T00:00:00.000Z");
    for (const account of ["account-a", "account-b"])
      await Effect.runPromise(
        saveProfile(previous, null, 0, profileKey(account)),
      );
    await Effect.runPromise(saveProfile(next, null, 0));
    await claimOnboardingProfile("account-a", "new");
    expect((await load(profileKey("account-a"))).profile).toEqual(next);
    expect((await load(profileKey("account-b"))).profile).toEqual(previous);
    await expect(
      Effect.runPromise(
        saveProfile(previous, null, 1, profileKey("account-a")),
      ),
    ).rejects.toThrow("changed in another window");
  });
  it("does not consume an unfinished onboarding draft", async () => {
    await Effect.runPromise(saveProfile(emptyProfile(), null, 0));
    await claimOnboardingProfile("account-a");
    expect((await load()).revision).toBe(1);
    expect((await load(profileKey("account-a"))).revision).toBe(0);
  });
});
