import { Effect, Schema } from "effect";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { extractCv } from "./cv.ts";
import { CvAnalysis, validateAnalysis } from "./analysis.ts";
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
  importCv: (file: File) => Promise<void>;
  analyzeCv: () => Promise<void>;
  removeCv: () => void;
  analysisAvailable: boolean;
  analysisAvailabilityMessage: string;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);
export function ProfileProvider({
  children,
  storageKey = "current",
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [capability, setCapability] = useState({
    available: false,
    message: "Checking the local analysis connection…",
  });
  const sourceGeneration = useRef(0);
  const analysisGeneration = useRef(0);
  const apiBase =
    window.location.protocol === "app:" ? "http://127.0.0.1:4310" : "";
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/api/cv-analysis/capability`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value: unknown = await response.json();
        if (
          value &&
          typeof value === "object" &&
          "available" in value &&
          typeof value.available === "boolean" &&
          "message" in value &&
          typeof value.message === "string"
        )
          setCapability({ available: value.available, message: value.message });
        else throw new Error();
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCapability({
            available: false,
            message:
              "The local CV analysis service is unavailable. You can continue manually and retry later.",
          });
      });
    return () => controller.abort();
  }, [apiBase]);
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
  async function importCv(file: File) {
    if (
      !/\.(pdf|docx)$/i.test(file.name) ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    )
      throw new Error("Choose a non-empty PDF or DOCX up to 10 MB.");
    const generation = ++sourceGeneration.current;
    ++analysisGeneration.current;
    let source;
    try {
      source = await extractCv(file);
    } catch (error) {
      const bytes = await file.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      source = {
        name: file.name,
        size: file.size,
        hash,
        importedAt: new Date().toISOString(),
        format: file.name.toLowerCase().endsWith("pdf")
          ? ("pdf" as const)
          : ("docx" as const),
        sections: [],
        warnings: [
          error instanceof Error ? error.message : "Extraction failed.",
        ],
        reviewedAt: "",
        notes: "",
      };
    }
    if (generation !== sourceGeneration.current) return;
    const current = currentData.current?.profile;
    if (!current) return;
    update(
      {
        cv: source,
        analysisHistory: current.analysis.result
          ? [...current.analysisHistory, current.analysis.result]
          : current.analysisHistory,
        analysis: {
          status: source.sections.length ? "idle" : "failed",
          sourceHash: source.hash,
          message: source.sections.length ? "" : source.warnings.join(" "),
          result: null,
        },
      },
      file,
    );
  }
  async function analyzeCv() {
    const cv = currentData.current?.profile.cv;
    if (!cv || !cv.sections.some((s) => s.text.trim())) return;
    const generation = ++analysisGeneration.current;
    const previous = currentData.current!.profile;
    update(
      {
        analysisHistory: previous.analysis.result
          ? [...previous.analysisHistory, previous.analysis.result]
          : previous.analysisHistory,
        analysis: {
          status: "running",
          sourceHash: cv.hash,
          message: "Analyzing your CV with the connected model…",
          result: null,
        },
      },
      undefined,
      true,
    );
    try {
      const source = {
        sourceHash: cv.hash,
        sections: cv.sections,
        warnings: cv.warnings,
      };
      const response = await fetch(`${apiBase}/api/cv-analysis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(source),
        signal: AbortSignal.timeout(370000),
      });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          value &&
            typeof value === "object" &&
            "error" in value &&
            typeof value.error === "string"
            ? value.error
            : "CV analysis is unavailable. Try again later.",
        );
      const result = Schema.decodeUnknownSync(CvAnalysis)(value);
      if (result.sourceHash !== cv.hash)
        throw new Error(
          "The analysis belongs to another source. Please retry.",
        );
      validateAnalysis(result, source);
      if (
        generation !== analysisGeneration.current ||
        currentData.current?.profile.cv?.hash !== cv.hash
      )
        return;
      const partial =
        !!cv.warnings.length ||
        !!result.limitations.length ||
        result.coverage.length < cv.sections.length;
      update(
        {
          analysis: {
            status: partial ? "partial" : "ready",
            sourceHash: cv.hash,
            message: partial
              ? "Some source details need review. Only supported findings are shown."
              : "Analysis ready for your review.",
            result,
          },
        },
        undefined,
        true,
      );
    } catch (error) {
      if (
        generation !== analysisGeneration.current ||
        currentData.current?.profile.cv?.hash !== cv.hash
      )
        return;
      update(
        {
          analysis: {
            status: "failed",
            sourceHash: cv.hash,
            message:
              error instanceof Error
                ? error.message
                : "Analysis failed. Your original and answers are preserved.",
            result: null,
          },
        },
        undefined,
        true,
      );
    }
  }
  function removeCv() {
    ++sourceGeneration.current;
    ++analysisGeneration.current;
    const p = currentData.current?.profile;
    if (!p) return;
    update(
      {
        cv: null,
        analysisHistory: p.analysis.result
          ? [...p.analysisHistory, p.analysis.result]
          : p.analysisHistory,
        analysis: { status: "idle", sourceHash: "", message: "", result: null },
      },
      null,
    );
  }
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
        importCv,
        analyzeCv,
        removeCv,
        analysisAvailable: capability.available,
        analysisAvailabilityMessage: capability.message,
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
