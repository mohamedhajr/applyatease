import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useProfile } from "../onboarding/ProfileProvider.tsx";
import { useWorkspaceSession } from "./ResearchSession.tsx";
import { useWorkflow } from "./WorkflowProvider.tsx";
import {
  assessmentCurrent,
  preparationCurrent,
  type Opportunity,
} from "./model.ts";

function Action({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="workflow-button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function ResearchProfileSetup() {
  const session = useWorkspaceSession();
  const canonical = useProfile();
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  if (!session.entry) return null;
  const profile = canonical.data?.profile;
  return (
    <section
      className="workflow-section research-profile"
      aria-label="Research profile setup"
    >
      <h3>Research evidence</h3>
      <p>
        Public source facts stay source-stated. Targets below are research
        choices; this profile cannot approve or send an application.
      </p>
      <label>
        Research profile name
        <input
          value={session.entry.name}
          onChange={(event) =>
            session.updateEntry({ name: event.target.value })
          }
        />
      </label>
      <label>
        Published CV source URL
        <input
          type="url"
          placeholder="https://…"
          value={session.entry.sourceUrl}
          onChange={(event) =>
            session.updateEntry({ sourceUrl: event.target.value })
          }
        />
      </label>
      <label>
        Import public CV locally
        <input
          type="file"
          accept=".pdf,.docx"
          disabled={importing || canonical.status === "loading"}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setImporting(true);
            setError("");
            void canonical
              .importCv(file)
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : "Import failed.",
                ),
              )
              .finally(() => setImporting(false));
            event.target.value = "";
          }}
        />
      </label>
      {profile?.cv && (
        <p>
          {profile.cv.name} · {profile.cv.sections.length} extracted sections ·
          source {profile.cv.hash.slice(0, 12)}
        </p>
      )}
      {profile?.cv?.warnings.map((warning) => (
        <p key={warning} className="workflow-warning">
          {warning}
        </p>
      ))}
      <Action
        disabled={
          !profile?.cv?.sections.length ||
          profile.analysis.status === "running" ||
          !canonical.analysisAvailable ||
          importing
        }
        onClick={() => void canonical.analyzeCv()}
      >
        {" "}
        {profile?.analysis.status === "running"
          ? "Analyzing CV…"
          : "Analyze research CV"}
      </Action>
      <p role="status">
        {profile?.analysis.message || canonical.analysisAvailabilityMessage}
      </p>
      {profile?.analysis.result && (
        <details>
          <summary>Review source-stated career evidence</summary>
          <p>
            {profile.analysis.result.facts.length} source-backed fact proposals.
            No candidate confirmation recorded.
          </p>
          {profile.analysis.result.facts.map((fact) => (
            <div key={fact.id} className="workflow-section">
              <strong>{fact.label}</strong>
              <p>{fact.value}</p>
              {fact.uncertainty && <p>{fact.uncertainty}</p>}
              {profile.analysis.result?.evidence
                .filter((evidence) => fact.evidenceIds.includes(evidence.id))
                .map((evidence) => (
                  <blockquote key={evidence.id}>
                    {evidence.section}: {evidence.quote}
                  </blockquote>
                ))}
            </div>
          ))}
        </details>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!role.trim() || !profile) return;
          if (
            !profile.roles.some(
              (item) => item.title.toLowerCase() === role.trim().toLowerCase(),
            )
          )
            canonical.update({
              roles: [
                ...profile.roles,
                {
                  title: role.trim(),
                  level: "",
                  experienceLevel: "",
                  experienceConfirmedAt: "",
                },
              ],
            });
          setRole("");
        }}
      >
        <label>
          Research target role
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Role to investigate"
          />
        </label>
        <button className="workflow-button" disabled={!role.trim() || !profile}>
          Add research target
        </button>
      </form>
      {!!profile?.roles.length && (
        <ul>
          {profile.roles.map((item) => (
            <li key={item.title}>
              {item.title}{" "}
              <button
                type="button"
                className="text-button"
                aria-label={`Remove research target ${item.title}`}
                onClick={() =>
                  canonical.update({
                    roles: profile.roles.filter(
                      (value) => value.title !== item.title,
                    ),
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p>
        Phase one covers remote English-language full-time and long-term
        contract roles in FDE, AWS Cloud, DevOps, digital marketing and video
        editing. Other research targets must be assessed against that scope.
      </p>
      {error && <p role="alert">{error}</p>}
      {canonical.status === "error" && (
        <p role="alert">
          {canonical.error}{" "}
          <button className="text-button" onClick={canonical.retry}>
            Retry profile save
          </button>
        </p>
      )}
    </section>
  );
}
export function WorkflowActions({ job }: { job: Opportunity | undefined }) {
  const workflow = useWorkflow();
  const session = useWorkspaceSession();
  const [url, setUrl] = useState("");
  const [formDraft, setFormDraft] = useState({ jobId: "", url: "" });
  const formUrl = formDraft.jobId === job?.id ? formDraft.url : "";
  const blocked =
    workflow.busy ||
    workflow.status === "loading" ||
    workflow.status === "error" ||
    !workflow.allowed ||
    !workflow.profile;
  const plan = workflow.data.plan;
  const planCurrent = plan?.run.profileVersion === workflow.profile?.version;
  const events = workflow.data.events
    .filter((event) => !event.opportunityId || event.opportunityId === job?.id)
    .slice(-12)
    .reverse();
  return (
    <div className="workflow-actions">
      <ResearchProfileSetup />
      {!session.researchOnly && (
        <p className="workflow-profile-link">
          <Link to="/profile">Review your search profile →</Link>
        </p>
      )}
      {!workflow.allowed && (
        <p className="workflow-warning">
          Sign in to work with your personal profile, or explicitly create a
          local research profile above. <Link to="/sign-in">Sign in</Link>
        </p>
      )}
      {workflow.error && (
        <div role="alert" className="workflow-warning">
          {workflow.error}
          {workflow.status === "error" && (
            <Action onClick={workflow.retry}>Retry save</Action>
          )}
        </div>
      )}
      <section
        className="workflow-section"
        aria-label="Search planning and discovery"
      >
        <div className="workflow-section-heading">
          <h3>Find your next opportunity</h3>
          <span className="neutral-badge">
            {workflow.status === "saving"
              ? "Saving locally…"
              : workflow.status === "saved"
                ? "Saved locally"
                : workflow.status}
          </span>
        </div>
        <p>
          Use your current profile to plan a bounded search, or import an
          employer posting. Sources and failures stay visible.
        </p>
        <div className="workflow-button-row">
          <Action
            disabled={blocked || !workflow.profile?.targets.length}
            onClick={() => void workflow.run("plan")}
          >
            {plan ? "Refresh search plan" : "Create search plan"}
          </Action>
          <Action
            disabled={blocked || !planCurrent}
            onClick={() => void workflow.run("discover")}
          >
            Discover jobs
          </Action>
          {workflow.busy && (
            <Action onClick={workflow.cancel}>Cancel operation</Action>
          )}
        </div>
        {plan && (
          <details open>
            <summary>
              Search plan {!planCurrent && "· profile changed; refresh needed"}
            </summary>
            <p>{plan.result.rationale}</p>
            <ul>
              {plan.result.queries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
            {!!plan.result.missingInputs.length && (
              <>
                <h4>Useful missing inputs</h4>
                <ul>
                  {plan.result.missingInputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            <RunInfo run={plan.run} />
          </details>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim()) void workflow.run("inspect", "", url.trim());
          }}
        >
          <label>
            Employer posting URL
            <input
              type="url"
              required
              placeholder="https://company.example/jobs/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
          <button className="workflow-button" disabled={blocked || !url.trim()}>
            Inspect & import posting
          </button>
        </form>
      </section>
      {job && (
        <section className="workflow-section" aria-label="Opportunity actions">
          <h3>{job.assessment?.result.title || "Imported opportunity"}</h3>
          <p>
            {job.source.status} · checked{" "}
            {new Date(job.source.retrievedAt).toLocaleString()}
          </p>
          <div className="workflow-button-row">
            <Action
              disabled={blocked}
              onClick={() => void workflow.run("inspect", job.id)}
            >
              Recheck source
            </Action>
            <Action
              disabled={blocked || job.source.status !== "inspected"}
              onClick={() => void workflow.run("assess", job.id)}
            >
              {job.assessment
                ? "Refresh assessment"
                : "Assess evidence & eligibility"}
            </Action>
          </div>
          {job.assessment &&
            !assessmentCurrent(job, workflow.profile?.version ?? "") && (
              <p className="workflow-warning">
                Profile or posting changed. The previous assessment is retained;
                refresh before relying on it.
              </p>
            )}
          {job.assessment && (
            <p>
              <strong>Next action:</strong> {job.assessment.result.nextAction}
            </p>
          )}
          <label>
            Application form URL
            <input
              type="url"
              value={formUrl}
              onChange={(event) =>
                setFormDraft({ jobId: job.id, url: event.target.value })
              }
              placeholder={
                job.assessment?.result.applicationUrl || job.source.canonicalUrl
              }
            />
          </label>
          <div className="workflow-button-row">
            <Action
              disabled={blocked}
              onClick={() =>
                void workflow.run("requirements", job.id, formUrl.trim())
              }
            >
              Inspect application requirements
            </Action>
            <Action
              disabled={
                blocked ||
                !job.requirements ||
                job.requirements.source.status !== "inspected"
              }
              onClick={() => void workflow.run("prepare", job.id)}
            >
              Prepare local review package
            </Action>
          </div>
          {job.requirements && (
            <p>
              Inspected application destination:{" "}
              <a
                href={job.requirements.source.finalUrl}
                target="_blank"
                rel="noreferrer"
              >
                {job.requirements.source.finalUrl}
              </a>
              . Check that this is the intended application before preparing.
            </p>
          )}
          <p>
            Requirements inspection reads accessible HTML. Login, CAPTCHA,
            conditional fields and browser behavior require a separate check.
          </p>
          {job.preparation &&
            !preparationCurrent(job, workflow.profile?.version ?? "") && (
              <p className="workflow-warning">
                Prepared material uses earlier evidence. Refresh requirements
                and prepare again before review.
              </p>
            )}
          <div className="workflow-button-row">
            <Action
              disabled={workflow.status === "error"}
              onClick={() =>
                workflow.editJob(job.id, {
                  disposition: job.disposition === "saved" ? "new" : "saved",
                })
              }
            >
              {job.disposition === "saved"
                ? "Unsave opportunity"
                : "Save opportunity"}
            </Action>
            <Action
              disabled={workflow.status === "error"}
              onClick={() =>
                workflow.editJob(job.id, {
                  disposition:
                    job.disposition === "dismissed" ? "new" : "dismissed",
                })
              }
            >
              {job.disposition === "dismissed"
                ? "Restore opportunity"
                : "Dismiss opportunity"}
            </Action>
          </div>
          <label>
            Private opportunity notes
            <textarea
              value={job.notes}
              onChange={(event) =>
                workflow.editJob(job.id, { notes: event.target.value })
              }
            />
          </label>
        </section>
      )}
      {!!events.length && (
        <section className="workflow-section" aria-label="Operation history">
          <h3>Actual operation history</h3>
          <ol className="workflow-events">
            {events.map((event) => (
              <li key={event.id}>
                <span className="neutral-badge">{event.status}</span>{" "}
                <strong>{event.action}</strong>
                <p>{event.message}</p>
                <time dateTime={event.at}>
                  {new Date(event.at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
export function RunInfo({
  run,
}: {
  run: {
    id: string;
    createdAt: string;
    model: string;
    skillVersion: string;
    skillHash: string;
    profileVersion: string;
    sourceHashes: readonly string[];
  };
}) {
  return (
    <details className="workflow-provenance">
      <summary>Result provenance</summary>
      <dl>
        <dt>Run</dt>
        <dd>{run.id}</dd>
        <dt>Created</dt>
        <dd>{run.createdAt}</dd>
        <dt>Model</dt>
        <dd>{run.model}</dd>
        <dt>Skill</dt>
        <dd>
          {run.skillVersion} · {run.skillHash}
        </dd>
        <dt>Profile version</dt>
        <dd>{run.profileVersion}</dd>
        <dt>Source hashes</dt>
        <dd>{run.sourceHashes.join(", ")}</dd>
      </dl>
    </details>
  );
}
