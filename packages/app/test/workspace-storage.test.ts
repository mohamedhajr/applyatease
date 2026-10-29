import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { emptyWorkspace } from "../src/workspace/model.ts";
import { loadWorkspace, saveWorkspace } from "../src/workspace/storage.ts";

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("applyatease-workspace");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});
describe("account-owned opportunity storage", () => {
  it("persists lifecycle events without sharing them across account/profile keys", async () => {
    const value = {
      ...emptyWorkspace(),
      events: [
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          opportunityId: "",
          action: "plan",
          status: "interrupted" as const,
          message: "The page closed before the operation completed.",
        },
      ],
    };
    const saved = await saveWorkspace("user:one", value, 0);
    expect(saved.revision).toBe(1);
    expect((await loadWorkspace("user:one")).events).toEqual(value.events);
    expect(await loadWorkspace("user:two")).toEqual(emptyWorkspace());
    expect(await loadWorkspace("research:one")).toEqual(emptyWorkspace());
  });
  it("rejects stale-tab writes atomically and preserves the durable version", async () => {
    const first = await saveWorkspace("user:one", emptyWorkspace(), 0);
    await expect(
      saveWorkspace(
        "user:one",
        { ...emptyWorkspace(), selectedId: "unsaved-selection" },
        0,
      ),
    ).rejects.toThrow("another tab");
    expect(await loadWorkspace("user:one")).toEqual(first);
  });
  it("preserves unreadable records instead of silently replacing them", async () => {
    await loadWorkspace("user:one");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("applyatease-workspace", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      transaction
        .objectStore("workspace")
        .put({ version: "unsupported" }, "user:one");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    await expect(loadWorkspace("user:one")).rejects.toThrow(
      "not been overwritten",
    );
    await expect(
      saveWorkspace("user:one", emptyWorkspace(), 0),
    ).rejects.toThrow("could not be saved");
    await expect(loadWorkspace("user:one")).rejects.toThrow(
      "not been overwritten",
    );
  });
});

it("archives exact binary artifacts immutably under the owning profile key", async () => {
  const { archiveCv, loadArchivedCv } =
    await import("../src/workspace/storage.ts");
  const original = new Blob([new Uint8Array([0, 1, 2, 3])]);
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await original.arrayBuffer()),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  await archiveCv("user:one", hash, original, "source.bin");
  await archiveCv("user:one", hash, original, "changed-name.bin");
  const saved = await loadArchivedCv("user:one", hash);
  expect(saved.name).toBe("source.bin");
  expect(new Uint8Array(await saved.original.arrayBuffer())).toEqual(
    new Uint8Array([0, 1, 2, 3]),
  );
  await expect(loadArchivedCv("user:two", hash)).rejects.toThrow(
    "not available",
  );
  await expect(
    archiveCv("user:one", "0".repeat(64), original, "source.bin"),
  ).rejects.toThrow("does not match");
});
