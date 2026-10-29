import { useState, type ReactNode } from "react";
import { loadArchivedCv } from "./storage.ts";
import { useWorkflow } from "./WorkflowProvider.tsx";
import { useWorkspaceSession } from "./ResearchSession.tsx";
import {
  assessmentCurrent,
  preparationCurrent,
  type Opportunity,
} from "./model.ts";
import { RunInfo } from "./WorkflowActions.tsx";

export function SourceLink({
  url,
  children,
}: {
  url: string;
  children?: ReactNode;
}) {
  let href = "";
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol)) href = parsed.href;
  } catch {
    href = "";
  }
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="text-link">
      {children || href}
    </a>
  ) : (
    <span>{children || url}</span>
  );
}
export function Evidence({
  items,
}: {
  items: readonly { source: string; section: string; quote: string }[];
}) {
  if (!items.length)
    return <p className="detail-help">No supporting quote attached.</p>;
  return (
    <details className="workflow-evidence">
      <summary>Supporting source wording ({items.length})</summary>
      {items.map((item, index) => (
        <blockquote key={`${index}:${item.section}`}>
          <p>{item.quote}</p>
          <cite>
            {item.source} · {item.section}
          </cite>
        </blockquote>
      ))}
    </details>
  );
}
export function JobDetails({ job }: { job: Opportunity }) {
  const workflow = useWorkflow();
  const assessment = job.assessment?.result;
  const current = assessmentCurrent(job, workflow.profile?.version ?? "");
  return (
    <div className="workflow-details">
      <div className="detail-intro">
        <div>
          <h2>{assessment?.title || "Imported opportunity"}</h2>
          <p>{assessment?.employer || "Employer not assessed"}</p>
        </div>
      </div>
      <section className="workflow-section">
        <h3>Source & freshness</h3>
        <SourceLink url={job.source.canonicalUrl}>
          Employer posting ↗
        </SourceLink>
        <p>
          Status: <strong>{job.source.status}</strong> · HTTP{" "}
          {job.source.httpStatus}
        </p>
        <p>Retrieved {new Date(job.source.retrievedAt).toLocaleString()}</p>
        <p className="workflow-hash">
          SHA-256: {job.source.hash || "No source bytes captured"}
        </p>
        {job.source.limitations.map((item) => (
          <p className="workflow-warning" key={item}>
            {item}
          </p>
        ))}
        {assessment && (
          <p>
            Vacancy freshness: {assessment.freshness}. This reflects the saved
            observation; recheck before relying on it.
          </p>
        )}
        <details>
          <summary>Captured posting text</summary>
          <pre className="workflow-source-text">{job.source.text}</pre>
        </details>
        {!!job.sourceHistory.length && (
          <details>
            <summary>
              Earlier source versions ({job.sourceHistory.length})
            </summary>
            {job.sourceHistory.map((source, index) => (
              <p className="workflow-hash" key={`${source.hash}:${index}`}>
                {source.retrievedAt} · {source.status} · {source.hash}
              </p>
            ))}
          </details>
        )}
      </section>
      <section className="workflow-section">
        <h3>Evidence & eligibility</h3>
        {!assessment ? (
          <p>
            Not assessed. Run an assessment to separate qualifications,
            constraints and unknowns.
          </p>
        ) : (
          <>
            <p className={!current ? "workflow-warning" : ""}>
              {current
                ? "Assessment uses the current profile and captured posting."
                : "Stale assessment: the profile or posting changed. Refresh the assessment."}
            </p>
            <strong>{assessment.verdict.replaceAll("_", " ")}</strong>
            <p>No overall score overrides any blocker below.</p>
            {assessment.dimensions.map((item, index) => (
              <article
                className="workflow-finding"
                key={`${item.dimension}:${index}`}
              >
                <h4>{item.dimension}</h4>
                <span className={`workflow-dimension ${item.result}`}>
                  {item.result}
                </span>
                <p>{item.reason}</p>
                <Evidence items={item.evidence} />
              </article>
            ))}
            <h3>Requirement evidence</h3>
            {assessment.requirements.map((item, index) => (
              <article
                className="workflow-finding"
                key={`${item.requirement}:${index}`}
              >
                <h4>{item.requirement}</h4>
                <span className="neutral-badge">
                  {item.support.replaceAll("_", " ")}
                </span>
                <p>{item.reason}</p>
                <Evidence items={item.evidence} />
              </article>
            ))}
            <p>
              Experience absent from the CV stays unverified; it does not prove
              a lack of skill.
            </p>
            {!!assessment.questions.length && (
              <>
                <h3>Open questions</h3>
                <ul>
                  {assessment.questions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            <p>
              <strong>Next action:</strong> {assessment.nextAction}
            </p>
            {job.assessment && <RunInfo run={job.assessment.run} />}
          </>
        )}
      </section>
      {job.requirements && (
        <section className="workflow-section">
          <h3>Observed application requirements</h3>
          <p>
            <strong>Partial · static HTML inspection</strong>
          </p>
          <SourceLink url={job.requirements.source.finalUrl}>
            Inspected application source ↗
          </SourceLink>
          <p>Inspected {job.requirements.source.retrievedAt}</p>
          {job.requirements.result.fields.map((field) => (
            <article className="workflow-finding" key={field.id}>
              <h4>{field.label}</h4>
              <p>
                {field.required} · {field.responseKind.replaceAll("_", " ")} ·{" "}
                {field.type}
              </p>
              <p>{field.constraints}</p>
              {!!field.choices.length && (
                <p>Observed options: {field.choices.join(", ")}</p>
              )}
              <p>Scope: {field.scope}</p>
              <Evidence items={field.evidence} />
            </article>
          ))}
          <h4>Attachments</h4>
          {job.requirements.result.attachments.length ? (
            <ul>
              {job.requirements.result.attachments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>
              No attachment requirements observed. Conditional fields remain
              unknown.
            </p>
          )}
          {job.requirements.result.limitations.map((item) => (
            <p key={item} className="workflow-warning">
              {item}
            </p>
          ))}
          <ul>
            {job.requirements.result.nextActions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <RunInfo run={job.requirements.run} />
        </section>
      )}
    </div>
  );
}
function ArchivedOriginal({ hash }: { hash: string | undefined }) {
  const session = useWorkspaceSession();
  const [error, setError] = useState("");
  return (
    <div>
      {hash ? (
        <button
          className="workflow-button"
          onClick={() => {
            setError("");
            void loadArchivedCv(session.key, hash)
              .then(({ original, name }) => {
                const url = URL.createObjectURL(original);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = name;
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "The archived CV could not be loaded.",
                ),
              );
          }}
        >
          Download exact source CV
        </button>
      ) : (
        <p>The original source was not archived for this earlier package.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function downloadPackage(job: Opportunity, profileVersion: string) {
  if (!preparationCurrent(job, profileVersion)) return;
  const content = JSON.stringify(
    {
      format: "applyatease-local-review-v1",
      opportunityId: job.id,
      exportedAt: new Date().toISOString(),
      source: {
        url: job.source.canonicalUrl,
        hash: job.source.hash,
        retrievedAt: job.source.retrievedAt,
      },
      requirements: job.requirements,
      preparation: job.preparation,
      userDraftEdits: job.answerDrafts,
      approval: "not_requested",
      applicationComplete: false,
    },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `local-review-${job.id}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function JobReview({ job }: { job: Opportunity }) {
  const workflow = useWorkflow();
  const session = useWorkspaceSession();
  const [section, setSection] = useState("all");
  const fields = job.requirements?.result.fields ?? [];
  const current = preparationCurrent(job, workflow.profile?.version ?? "");
  const packageResult = current ? job.preparation?.result : undefined;
  return (
    <div className="workflow-details">
      <div className="review-intro">
        <h2>Your application review</h2>
        <p>
          {packageResult
            ? "Local writing and a proposed CV edit plan are available for inspection."
            : "Inspect requirements and prepare a local review package to see proposed materials."}
        </p>
        <span className="neutral-badge">
          {packageResult ? "Awaiting review" : "Not prepared"}
        </span>
        <p>
          <strong>Application incomplete</strong> · requirements remain partial.
        </p>
        {session.researchOnly && (
          <p className="workflow-warning">
            Research only. No candidate confirmations, approval or transmission
            is available.
          </p>
        )}
        {packageResult && !current && (
          <p className="workflow-warning">
            This package uses earlier source or profile versions. Refresh before
            relying on it.
          </p>
        )}
      </div>
      <div className="workflow-review-filter">
        <label>
          Review section
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="all">All review sections</option>
            <option value="profile_fact">Your profile</option>
            <option value="draftable_answer">Drafted answers</option>
            <option value="critical_confirmation">
              Confirm before applying
            </option>
          </select>
        </label>
      </div>
      {(
        [
          ["profile_fact", "Your profile"],
          ["draftable_answer", "Drafted answers"],
          ["critical_confirmation", "Confirm before applying"],
        ] as const
      )
        .filter(([kind]) => section === "all" || section === kind)
        .map(([kind, title]) => (
          <section className="workflow-section" key={kind}>
            <h3>{title}</h3>
            {fields
              .filter((field) => field.responseKind === kind)
              .map((field) => {
                const answer = packageResult?.answers.find(
                  (item) => item.fieldId === field.id,
                );
                return (
                  <article className="workflow-finding" key={field.id}>
                    <h4>{field.label}</h4>
                    <p>
                      {field.required} · scope: {field.scope}
                    </p>
                    {answer ? (
                      <>
                        <span className="neutral-badge">
                          {answer.status.replaceAll("_", " ")}
                        </span>
                        <p className="workflow-answer">
                          {answer.text || "No proposed answer."}
                        </p>
                        <Evidence items={answer.evidence} />
                      </>
                    ) : (
                      <p>Unanswered. No value has been inferred.</p>
                    )}
                    {kind === "critical_confirmation" && (
                      <p className="workflow-warning">
                        Requires the actual applicant’s explicit response. An
                        unanswered required declaration blocks application
                        completion.
                      </p>
                    )}
                    {kind === "draftable_answer" &&
                      answer?.status !== "manual_task" && (
                        <label>
                          Your proposed wording
                          <textarea
                            value={
                              job.answerDrafts[field.id] ?? answer?.text ?? ""
                            }
                            onChange={(event) =>
                              workflow.editJob(job.id, {
                                answerDrafts: {
                                  ...job.answerDrafts,
                                  [field.id]: event.target.value,
                                },
                              })
                            }
                          />
                          <span>
                            Saved as draft wording; no confirmation or
                            submission approval.
                          </span>
                        </label>
                      )}
                  </article>
                );
              })}
            {!fields.some((field) => field.responseKind === kind) && (
              <p>
                {job.requirements
                  ? "No questions in this section were observed. Uninspected conditional questions remain unknown."
                  : "Requirements have not been inspected."}
              </p>
            )}
            {kind === "critical_confirmation" &&
              !!packageResult?.confirmations.length && (
                <ul>
                  {packageResult.confirmations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
          </section>
        ))}
      {fields.some((field) => field.responseKind === "manual_task") && (
        <section className="workflow-section">
          <h3>Applicant-only tasks</h3>
          {fields
            .filter((field) => field.responseKind === "manual_task")
            .map((field) => (
              <p key={field.id}>
                {field.label} — {field.constraints}
              </p>
            ))}
        </section>
      )}
      {packageResult && (
        <>
          <section className="workflow-section">
            <h3>Whole-CV evaluation</h3>
            <p>
              <strong>Exact edit plan only.</strong> The original CV has not
              been edited or rebuilt. Document fidelity remains unverified until
              the proposed changes are applied and visually checked.
            </p>
            {packageResult.sectionReview.map((item, index) => (
              <article
                key={`${item.section}:${index}`}
                className="workflow-finding"
              >
                <h4>
                  {item.section} · {item.decision}
                </h4>
                <p>{item.reason}</p>
              </article>
            ))}
            <h3>Proposed surgical edits</h3>
            {!packageResult.edits.length && <p>No supported edits proposed.</p>}
            {packageResult.edits.map((item, index) => (
              <article
                key={`${item.section}:${index}`}
                className="workflow-finding"
              >
                <h4>{item.section}</h4>
                <p>Before</p>
                <blockquote>{item.before}</blockquote>
                <p>Proposed replacement</p>
                <blockquote>{item.after}</blockquote>
                <p>{item.reason}</p>
                <Evidence items={item.evidence} />
              </article>
            ))}
          </section>
          {packageResult.coverLetter && (
            <section className="workflow-section">
              <h3>Proposed letter</h3>
              <p className="workflow-answer">{packageResult.coverLetter}</p>
              <p>
                Draft wording for applicant review; proposed motivation is not a
                confirmed personal belief.
              </p>
            </section>
          )}
          <section className="workflow-section">
            <h3>Quality findings & limitations</h3>
            <ul>
              {packageResult.qualityChecks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {packageResult.limitations.map((item) => (
              <p key={item} className="workflow-warning">
                {item}
              </p>
            ))}
            {job.preparation && <RunInfo run={job.preparation.run} />}
            <button
              className="workflow-button"
              onClick={() =>
                downloadPackage(job, workflow.profile?.version ?? "")
              }
            >
              Download local review package
            </button>
            <ArchivedOriginal hash={job.preparation?.cvSourceHash} />
            <p>
              The JSON package contains actual generated wording, edit proposals
              and provenance. It is not an edited CV or an application
              attachment.
            </p>
          </section>
        </>
      )}
      {job.preparation && !current && (
        <section className="workflow-section">
          <h3>Earlier preparation · refresh required</h3>
          <p>
            The saved wording belongs to earlier source, profile or requirement
            versions. It is retained for inspection but cannot be exported as a
            current package.
          </p>
          <details>
            <summary>Inspect retained preparation and provenance</summary>
            <pre className="workflow-source-text">
              {JSON.stringify(job.preparation, null, 2)}
            </pre>
          </details>
          <ArchivedOriginal hash={job.preparation.cvSourceHash} />
        </section>
      )}
      {!!job.draftHistory?.length && (
        <section className="workflow-section">
          <h3>Retained draft edits</h3>
          <p>
            These edits belong to earlier checklists or duplicate source
            records. They have not been reassigned to current questions.
          </p>
          {job.draftHistory.map((entry, index) => (
            <details key={`${entry.opportunityId}:${index}`}>
              <summary>{entry.savedAt} · previous answers</summary>
              <pre className="workflow-source-text">
                {JSON.stringify(entry, null, 2)}
              </pre>
            </details>
          ))}
        </section>
      )}
      {!!job.preparationHistory?.length && (
        <section className="workflow-section">
          <h3>Previous local packages</h3>
          {job.preparationHistory.map((previous, index) => (
            <details key={`${previous.run.id}:${index}`}>
              <summary>
                {previous.run.createdAt} · superseded local package
              </summary>
              <p>
                Preserved for comparison. It does not use current evidence by
                default.
              </p>
              <pre className="workflow-source-text">
                {JSON.stringify(previous.result, null, 2)}
              </pre>
              <RunInfo run={previous.run} />
              <ArchivedOriginal hash={previous.cvSourceHash} />
            </details>
          ))}
        </section>
      )}
      <section className="workflow-section">
        <h3>Execution boundary</h3>
        <p>
          No information has been entered into employer forms, uploaded or
          submitted. Local review does not authorize transmission. Live
          execution is unavailable in this workspace.
        </p>
      </section>
    </div>
  );
}
