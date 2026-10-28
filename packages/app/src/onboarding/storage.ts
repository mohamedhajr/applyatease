import { Data, Effect, Schema } from "effect";
import { emptyProfile, Profile } from "./model.ts";

export type LocalProfile = {
  profile: Profile;
  original: Blob | null;
  revision: number;
};
export class ProfileStorageError extends Data.TaggedError(
  "ProfileStorageError",
)<{
  message: string;
}> {}
const databaseName = "applyatease-profile";
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("profile");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Local storage could not be opened."));
    request.onblocked = () =>
      reject(new Error("Close other Apply at Ease tabs and try again."));
  });
}
function decodeRecord(value: unknown): LocalProfile {
  if (value === undefined)
    return { profile: emptyProfile(), original: null, revision: 0 };
  if (
    !value ||
    typeof value !== "object" ||
    !("profile" in value) ||
    !("original" in value) ||
    !("revision" in value)
  )
    throw new Error(
      "Your saved profile could not be read. It has not been overwritten.",
    );
  const profile = Schema.decodeUnknownSync(Profile)(value.profile);
  if (
    !(value.original === null || value.original instanceof Blob) ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision)
  )
    throw new Error(
      "Your saved profile could not be read. It has not been overwritten.",
    );
  if (Boolean(profile.cv) !== Boolean(value.original))
    throw new Error("The saved CV is incomplete. It has not been overwritten.");
  return { profile, original: value.original, revision: value.revision };
}
const failure = (error: unknown) =>
  new ProfileStorageError({
    message:
      error instanceof Error ? error.message : "Local storage is unavailable.",
  });
export const loadProfile = Effect.tryPromise({
  try: async () => {
    const db = await openDatabase();
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const request = db
          .transaction("profile")
          .objectStore("profile")
          .get("current");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(new Error("Your profile could not be loaded."));
      });
      return decodeRecord(value);
    } finally {
      db.close();
    }
  },
  catch: failure,
});
export const saveProfile = (
  profile: Profile,
  original: Blob | null,
  revision: number,
) =>
  Effect.tryPromise({
    try: async () => {
      const db = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction("profile", "readwrite");
          const store = transaction.objectStore("profile");
          const request = store.get("current");
          let conflict = false;
          request.onsuccess = () => {
            let current: LocalProfile;
            try {
              current = decodeRecord(request.result);
            } catch {
              transaction.abort();
              return;
            }
            if (current.revision !== revision) {
              conflict = true;
              transaction.abort();
              return;
            }
            store.put({ profile, original, revision: revision + 1 }, "current");
          };
          transaction.oncomplete = () => resolve();
          transaction.onabort = transaction.onerror = () =>
            reject(
              new Error(
                conflict
                  ? "This profile changed in another window. Reload to use the latest saved version."
                  : "Changes could not be saved on this device. Keep this page open and retry.",
              ),
            );
        });
        return revision + 1;
      } finally {
        db.close();
      }
    },
    catch: failure,
  });
