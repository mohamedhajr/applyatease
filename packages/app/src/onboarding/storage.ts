import { Data, Effect } from "effect";
import { emptyProfile, migrateProfile, type Profile } from "./model.ts";

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
  const profile = migrateProfile(value.profile);
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
export const loadProfileFor = (key = "current") =>
  Effect.tryPromise({
    try: async () => {
      const db = await openDatabase();
      try {
        const value = await new Promise<unknown>((resolve, reject) => {
          const request = db
            .transaction("profile")
            .objectStore("profile")
            .get(key);
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
export const loadProfile = loadProfileFor();
export const profileKey = (userId: string | undefined) =>
  userId ? `user:${userId}` : "current";

export const saveProfile = (
  profile: Profile,
  original: Blob | null,
  revision: number,
  key = "current",
) =>
  Effect.tryPromise({
    try: async () => {
      const db = await openDatabase();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction("profile", "readwrite");
          const store = transaction.objectStore("profile");
          const request = store.get(key);
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
            store.put({ profile, original, revision: revision + 1 }, key);
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

export async function claimOnboardingProfile(
  userId: string,
  choice?: "new" | "saved",
) {
  const db = await openDatabase();
  try {
    return await new Promise<"saved" | "conflict">((resolve, reject) => {
      const tx = db.transaction("profile", "readwrite");
      const store = tx.objectStore("profile");
      const draft = store.get("current");
      const account = store.get(profileKey(userId));
      let result: "saved" | "conflict" = "saved";
      account.onsuccess = () => {
        try {
          if (draft.result === undefined) return;
          const source = decodeRecord(draft.result);
          if (!source.profile.confirmedAt) return;
          if (account.result !== undefined && !choice) {
            result = "conflict";
            return;
          }
          const existing =
            account.result === undefined
              ? undefined
              : decodeRecord(account.result);
          if (choice !== "saved" || !existing)
            store.put(
              {
                ...source,
                revision:
                  Math.max(source.revision, existing?.revision ?? 0) + 1,
              },
              profileKey(userId),
            );
          store.delete("current");
        } catch {
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            "Your onboarding profile could not be linked. It is still saved on this device. Please retry.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
