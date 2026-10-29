import { Effect } from "effect";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { editProfile, type Profile } from "./model.ts";
import { loadProfileFor, saveProfile, type LocalProfile } from "./storage.ts";

type ProfileContextValue = {
  data: LocalProfile | null;
  status: "loading" | "saving" | "saved" | "error";
  error: string;
  update: (
    patch: Partial<Profile>,
    original?: Blob | null,
    navigationOnly?: boolean,
  ) => void;
  retry: () => void;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);
export function ProfileProvider({
  children,
  storageKey = "current",
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [data, setData] = useState<LocalProfile | null>(null);
  const [status, setStatus] =
    useState<ProfileContextValue["status"]>("loading");
  const [error, setError] = useState("");
  const revision = useRef(0);
  const currentData = useRef<LocalProfile | null>(null);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const failed = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    void Effect.runPromise(Effect.result(loadProfileFor(storageKey))).then(
      (result) => {
        if (!active) return;
        if (result._tag === "Failure") {
          setError(result.failure.message);
          setStatus("error");
          return;
        }
        revision.current = result.success.revision;
        currentData.current = result.success;
        setData(result.success);
        setStatus("saved");
      },
    );
    return () => {
      active = false;
    };
  }, [retryCount, storageKey]);
  function persist(next: LocalProfile) {
    const current = ++generation.current;
    setStatus("saving");
    queue.current = queue.current.then(async () => {
      if (failed.current || current !== generation.current) return;
      const result = await Effect.runPromise(
        Effect.result(
          saveProfile(
            next.profile,
            next.original,
            revision.current,
            storageKey,
          ),
        ),
      );
      if (result._tag === "Failure") {
        failed.current = true;
        setError(result.failure.message);
        setStatus("error");
      } else {
        revision.current = result.success;
        if (generation.current === current) {
          setStatus("saved");
          setError("");
        }
      }
    });
  }
  // A current ref prevents multiple field updates in one event from losing each other.
  const update: ProfileContextValue["update"] = (
    patch,
    original,
    navigationOnly = false,
  ) => {
    const previous = currentData.current;
    if (!previous) return;
    const next = {
      ...previous,
      profile: navigationOnly
        ? { ...previous.profile, ...patch }
        : editProfile(previous.profile, patch),
      original: original === undefined ? previous.original : original,
    };
    currentData.current = next;
    setData(next);
    if (!failed.current) persist(next);
  };
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (status === "saving" || (status === "error" && data))
        event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [status, data]);
  return (
    <ProfileContext.Provider
      value={{
        data,
        status,
        error,
        update,
        retry: () => {
          if (data) {
            failed.current = false;
            persist(data);
          } else {
            setStatus("loading");
            setRetryCount((n) => n + 1);
          }
        },
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("ProfileProvider is required");
  return context;
}
