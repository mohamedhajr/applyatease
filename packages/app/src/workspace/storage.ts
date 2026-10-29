import { Schema } from "effect";
import { emptyWorkspace, Workspace } from "./model.ts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("applyatease-workspace", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("workspace"))
        request.result.createObjectStore("workspace");
      if (!request.result.objectStoreNames.contains("documents"))
        request.result.createObjectStore("documents");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Your opportunity storage could not be opened."));
    request.onblocked = () =>
      reject(new Error("Close other workspace tabs and retry."));
  });
}
export async function loadWorkspace(key: string): Promise<Workspace> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("workspace")
        .objectStore("workspace")
        .get(key);
      request.onsuccess = () => {
        try {
          resolve(
            request.result === undefined
              ? emptyWorkspace()
              : Schema.decodeUnknownSync(Workspace)(request.result),
          );
        } catch {
          reject(
            new Error(
              "Saved opportunities could not be read. Your stored data has not been overwritten.",
            ),
          );
        }
      };
      request.onerror = () =>
        reject(new Error("Saved opportunities could not be loaded."));
    });
  } finally {
    db.close();
  }
}
export async function saveWorkspace(
  key: string,
  next: Workspace,
  revision: number,
): Promise<Workspace> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("workspace", "readwrite");
      const store = transaction.objectStore("workspace");
      const request = store.get(key);
      let conflict = false;
      const saved = { ...next, revision: revision + 1 };
      request.onsuccess = () => {
        const previous: unknown = request.result;
        let previousRevision: number;
        try {
          previousRevision =
            previous === undefined
              ? 0
              : Schema.decodeUnknownSync(Workspace)(previous).revision;
        } catch {
          transaction.abort();
          return;
        }
        if (previousRevision !== revision) {
          conflict = true;
          transaction.abort();
          return;
        }
        store.put(saved, key);
      };
      transaction.oncomplete = () => resolve(saved);
      transaction.onabort = () =>
        reject(
          new Error(
            conflict
              ? "This workspace changed in another tab. Reload before continuing; your latest change was not saved."
              : "Your opportunities could not be saved. Keep this tab open and retry.",
          ),
        );
      transaction.onerror = () =>
        reject(
          new Error(
            "Your opportunities could not be saved. Check available local storage and retry.",
          ),
        );
    });
  } finally {
    db.close();
  }
}

export async function archiveCv(
  key: string,
  hash: string,
  original: Blob,
  name: string,
): Promise<void> {
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await original.arrayBuffer()),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (digest !== hash)
    throw new Error(
      "The original CV does not match its source hash. Reimport the exact source before preparing.",
    );
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("documents", "readwrite");
      const store = transaction.objectStore("documents");
      const request = store.get(`${key}:${hash}`);
      request.onsuccess = () => {
        if (request.result === undefined)
          store.put(
            { original, name, hash, storedAt: new Date().toISOString() },
            `${key}:${hash}`,
          );
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () =>
        reject(
          new Error(
            "The exact original CV could not be archived. No new package was prepared.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function loadArchivedCv(
  key: string,
  hash: string,
): Promise<{ original: Blob; name: string }> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("documents")
        .objectStore("documents")
        .get(`${key}:${hash}`);
      request.onsuccess = () => {
        const value: unknown = request.result;
        if (
          value &&
          typeof value === "object" &&
          "hash" in value &&
          value.hash === hash &&
          "name" in value &&
          typeof value.name === "string" &&
          "original" in value &&
          value.original instanceof Blob
        )
          resolve({ original: value.original, name: value.name });
        else
          reject(
            new Error(
              "The exact original CV is not available in this local archive.",
            ),
          );
      };
      request.onerror = () =>
        reject(new Error("The archived original CV could not be loaded."));
    });
  } finally {
    db.close();
  }
}
