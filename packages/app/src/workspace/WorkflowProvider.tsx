import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Schema } from "effect";
import {
  Assessment,
  DiscoverResult,
  Preparation,
  Requirements,
  RunMetadata,
  SearchPlan,
  SourceCapture,
  type WorkflowProfile,
} from "@applyatease/contracts/workflow";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useProfile } from "../onboarding/ProfileProvider.tsx";
import type { Profile } from "../onboarding/model.ts";
import { useWorkspaceSession } from "./ResearchSession.tsx";
import { archiveCv, loadWorkspace, saveWorkspace } from "./storage.ts";
import {
  archiveAnswerDrafts,
  emptyWorkspace,
  deduplicateAssessed,
  mergeSource,
  workflowProfile,
  type Opportunity,
  type Workspace,
} from "./model.ts";

const PlanResponse = Schema.Struct({ result: SearchPlan, run: RunMetadata });
const DiscoveryResponse = Schema.Struct({
  result: DiscoverResult,
  run: RunMetadata,
});
const AssessmentResponse = Schema.Struct({
  result: Assessment,
  run: RunMetadata,
});
const RequirementsResponse = Schema.Struct({
  result: Requirements,
  run: RunMetadata,
  source: SourceCapture,
});
const PreparationResponse = Schema.Struct({
  result: Preparation,
  run: RunMetadata,
});
type ContextValue = {
  data: Workspace;
  profile: WorkflowProfile | null;
  status: "loading" | "saved" | "saving" | "error";
  error: string;
  busy: boolean;
  allowed: boolean;
  run: (
    action:
      "plan" | "discover" | "inspect" | "assess" | "requirements" | "prepare",
    jobId?: string,
    url?: string,
  ) => Promise<void>;
  cancel: () => void;
  retry: () => void;
  select: (id: string) => void;
  editJob: (
    id: string,
    patch: Partial<Pick<Opportunity, "disposition" | "notes" | "answerDrafts">>,
  ) => void;
};
const Context = createContext<ContextValue | null>(null);
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const session = useWorkspaceSession();
  const canonical = useProfile();
  const auth = useAuth();
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [preparedProfile, setPreparedProfile] = useState<{
    input: Profile;
    value: WorkflowProfile;
  } | null>(null);
  const profile =
    preparedProfile?.input === canonical.data?.profile
      ? (preparedProfile?.value ?? null)
      : null;
  const [status, setStatus] = useState<ContextValue["status"]>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef(data);
  const revision = useRef(0);
  const queue = useRef(Promise.resolve());
  const failed = useRef(false);
  const loaded = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(0);
  const allowed = session.researchOnly || !!auth.user;
  const persist = useCallback(
    (next: Workspace) => {
      current.current = next;
      setData(next);
      setStatus("saving");
      const request = ++pending.current;
      queue.current = queue.current.then(async () => {
        if (failed.current) return;
        try {
          const saved = await saveWorkspace(
            session.key,
            next,
            revision.current,
          );
          revision.current = saved.revision;
          if (alive.current && request === pending.current) {
            setStatus("saved");
          }
        } catch (cause) {
          failed.current = true;
          if (alive.current) {
            setStatus("error");
            setError(
              cause instanceof Error
                ? cause.message
                : "The workspace could not be saved.",
            );
          }
        }
      });
    },
    [session.key],
  );
  useEffect(() => {
    alive.current = true;
    void loadWorkspace(session.key)
      .then((saved) => {
        if (!alive.current) return;
        revision.current = saved.revision;
        loaded.current = true;
        const interrupted = saved.events.some(
          (event) => event.status === "running",
        );
        const next = {
          ...saved,
          events: saved.events.map((event) =>
            event.status === "running"
              ? {
                  ...event,
                  status: "interrupted" as const,
                  message:
                    "The page or connection closed before the result was saved. Recheck the source or retry this operation.",
                }
              : event,
          ),
        };
        current.current = next;
        setData(next);
        setStatus("saved");
        if (interrupted) persist(next);
      })
      .catch((cause: unknown) => {
        if (alive.current) {
          failed.current = true;
          setStatus("error");
          setError(
            cause instanceof Error
              ? cause.message
              : "The workspace could not be loaded.",
          );
        }
      });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [persist, session.key]);
  useEffect(() => {
    let active = true;
    if (canonical.data)
      void workflowProfile(
        canonical.data.profile,
        session.key,
        session.researchOnly,
      )
        .then((value) => {
          if (active && canonical.data) {
            setPreparedProfile({ input: canonical.data.profile, value });
            setError((previous) =>
              previous ===
              "Your current profile could not be prepared for this workflow."
                ? ""
                : previous,
            );
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Your current profile could not be prepared for this workflow.",
            );
        });
    return () => {
      active = false;
    };
  }, [canonical.data, session.key, session.researchOnly]);
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (status === "saving" || status === "error" || busy)
        event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [status, busy]);
  function mutate(update: (previous: Workspace) => Workspace) {
    if (status === "loading" || failed.current) return;
    persist(update(current.current));
  }
  async function run(
    action: Parameters<ContextValue["run"]>[0],
    jobId = "",
    url = "",
  ) {
    if (
      controller.current ||
      failed.current ||
      status === "loading" ||
      !allowed
    )
      return;
    if (!profile) {
      setError("Wait for your profile to finish loading.");
      return;
    }
    const job = current.current.opportunities.find((item) => item.id === jobId);
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    const eventId = crypto.randomUUID();
    const at = new Date().toISOString();
    mutate((previous) => ({
      ...previous,
      events: [
        ...previous.events,
        {
          id: eventId,
          at,
          opportunityId: jobId,
          action,
          status: "running",
          message: `${action} requested`,
        },
      ],
    }));
    const request = async (path: string, body: unknown): Promise<unknown> => {
      const response = await fetch(`${auth.apiBaseUrl}/workflow/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(600_000)]),
      });
      const value: unknown = await response.json().catch(() => null);
      if (!alive.current || abort.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      if (!response.ok)
        throw new Error(
          value &&
            typeof value === "object" &&
            "error" in value &&
            typeof value.error === "string"
            ? value.error
            : `The ${path} request failed (${response.status}).`,
        );
      return value;
    };
    try {
      let message = "";
      if (action === "plan") {
        if (!profile.targets.length)
          throw new Error(
            "Choose at least one target role in your profile before planning.",
          );
        const result = Schema.decodeUnknownSync(PlanResponse)(
          await request("plan", { profile }),
        );
        mutate((previous) => ({ ...previous, plan: result }));
        message = `Search plan prepared with ${result.result.queries.length} queries.`;
      } else if (action === "discover") {
        const plan = current.current.plan;
        if (!plan || plan.run.profileVersion !== profile.version)
          throw new Error(
            "Create a current search plan before discovering jobs.",
          );
        const value = Schema.decodeUnknownSync(DiscoveryResponse)(
          await request("discover", { profile, plan: plan.result }),
        );
        mutate((previous) =>
          value.result.sources.reduce(
            (next, source) => mergeSource(next, source),
            previous,
          ),
        );
        message = `${value.result.sources.length} sources inspected. ${value.result.limitations.join(" ")}`;
      } else if (action === "inspect") {
        const source = Schema.decodeUnknownSync(SourceCapture)(
          await request("inspect", {
            url: url || job?.source.originalUrl,
            researchOnly: session.researchOnly,
          }),
        );
        mutate((previous) =>
          mergeSource(
            previous,
            source,
            new Date().toISOString(),
            jobId || undefined,
          ),
        );
        message = `Source ${source.status}. ${source.limitations.join(" ")}`;
      } else {
        if (!job) throw new Error("Select an opportunity first.");
        let patch: Partial<Opportunity>;
        if (action === "assess") {
          if (job.source.status !== "inspected")
            throw new Error(
              "Recheck the posting before assessing it. Its source is not verified.",
            );
          patch = {
            assessment: {
              ...Schema.decodeUnknownSync(AssessmentResponse)(
                await request("assess", { profile, job: job.source }),
              ),
              sourceUrl: job.source.canonicalUrl,
            },
          };
          message = "Evidence and eligibility assessment saved.";
        } else if (action === "requirements") {
          const destination =
            url ||
            job.assessment?.result.applicationUrl ||
            job.source.canonicalUrl;
          const requirements = Schema.decodeUnknownSync(RequirementsResponse)(
            await request("requirements", {
              url: destination,
              researchOnly: session.researchOnly,
            }),
          );
          const bytes = new TextEncoder().encode(
            JSON.stringify(requirements.result),
          );
          const version = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("");
          if (!alive.current || abort.signal.aborted)
            throw new DOMException("Cancelled", "AbortError");
          patch = {
            requirements: { ...requirements, version },
          };
          message =
            "Observed form requirements saved. Conditional and browser-only fields remain unverified.";
        } else {
          if (!job.requirements)
            throw new Error(
              "Inspect the application requirements before preparing materials.",
            );
          if (job.requirements.source.status !== "inspected")
            throw new Error(
              "The application source is not accessible. Resolve its access limitation before preparing materials.",
            );
          const original = canonical.data?.original;
          const source = canonical.data?.profile.cv;
          if (!original || !source || source.hash !== profile.source.sourceHash)
            throw new Error(
              "The exact original CV is unavailable. Reimport it before preparing.",
            );
          await archiveCv(session.key, source.hash, original, source.name);
          if (!alive.current || abort.signal.aborted)
            throw new DOMException("Cancelled", "AbortError");
          const preparation = Schema.decodeUnknownSync(PreparationResponse)(
            await request("prepare", {
              profile,
              job: job.source,
              form: job.requirements.source,
              requirements: job.requirements.result,
            }),
          );
          patch = {
            preparation: {
              ...preparation,
              requirementsVersion: job.requirements.version ?? "",
              cvSourceHash: source.hash,
              sourceUrl: job.source.canonicalUrl,
            },
          };
          message =
            "Local edit plan and proposed answers saved for review. No edited CV or application completion is claimed.";
        }
        mutate((previous) =>
          deduplicateAssessed(
            {
              ...previous,
              opportunities: previous.opportunities.map((item) => {
                if (item.id !== jobId) return item;
                return {
                  ...item,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                  ...(action === "requirements" || action === "prepare"
                    ? archiveAnswerDrafts(item)
                    : {}),
                  ...(action === "requirements"
                    ? {
                        requirementsHistory: [
                          ...(item.requirementsHistory ?? []),
                          ...(item.requirements ? [item.requirements] : []),
                        ],
                      }
                    : {}),
                  ...(action === "prepare"
                    ? {
                        preparationHistory: [
                          ...(item.preparationHistory ?? []),
                          ...(item.preparation ? [item.preparation] : []),
                        ],
                      }
                    : {}),
                };
              }),
            },
            jobId,
          ),
        );
      }
      if (abort.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      mutate((previous) => ({
        ...previous,
        events: previous.events.map((item) =>
          item.id === eventId
            ? { ...item, status: "completed", message }
            : item,
        ),
      }));
    } catch (cause) {
      const cancelled = abort.signal.aborted;
      const message = cancelled
        ? "Operation cancelled. Previously saved results are preserved."
        : cause instanceof Error
          ? cause.message
          : "Operation failed. Retry when the connection is available.";
      if (alive.current) {
        setError(message);
        mutate((previous) => ({
          ...previous,
          events: previous.events.map((item) =>
            item.id === eventId
              ? { ...item, status: cancelled ? "cancelled" : "failed", message }
              : item,
          ),
        }));
      }
    } finally {
      controller.current = null;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        profile,
        status,
        error,
        busy,
        allowed,
        run,
        cancel: () => controller.current?.abort(),
        retry: () => {
          if (!loaded.current) {
            window.location.reload();
            return;
          }
          failed.current = false;
          setError("");
          persist(current.current);
        },
        select: (id) => mutate((previous) => ({ ...previous, selectedId: id })),
        editJob: (id, patch) =>
          mutate((previous) => ({
            ...previous,
            opportunities: previous.opportunities.map((job) =>
              job.id === id
                ? { ...job, ...patch, updatedAt: new Date().toISOString() }
                : job,
            ),
          })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkflow() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkflowProvider is required.");
  return value;
}
