import { Button } from "@base-ui/react/button";
import { useProfile } from "./ProfileProvider.tsx";
import type { CvAnalysis } from "./analysis.ts";
import { effectiveAnalysis } from "./model.ts";
import { downloadOriginal } from "./cv.ts";

function References({
  result,
  ids,
}: {
  result: CvAnalysis;
  ids: readonly string[];
}) {
  return (
    <details>
      <summary>View source evidence</summary>
      {result.evidence
        .filter((e) => ids.includes(e.id))
        .map((e) => (
          <blockquote key={e.id}>
            <small>{e.section}</small>
            <p>{e.quote}</p>
          </blockquote>
        ))}
    </details>
  );
}
export function CvInsights() {
  const { data, analyzeCv, analysisAvailable, analysisAvailabilityMessage } =
    useProfile();
  if (!data?.profile.cv) return null;
  const { cv, analysis } = data.profile;
  const result = effectiveAnalysis(data.profile);
  return (
    <div className="onb-insights">
      {!result && (
        <>
          <p role="status" className="onb-note">
            {analysis.message || "Your document is ready for analysis."}
          </p>
          <p className="onb-hint">{analysisAvailabilityMessage}</p>
        </>
      )}
      {result && (
        <>
          <div className="onb-snapshot">
            {result.snapshot.map((claim, i) => (
              <div key={i}>
                <p>{claim.text}</p>
                <References result={result} ids={claim.evidenceIds} />
              </div>
            ))}
          </div>
          {!!result.limitations.length && (
            <details className="onb-warning">
              <summary>
                What needs context · {result.limitations.length}
              </summary>
              <ul>
                {result.limitations.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="onb-options">
            {result.roles.map((role) => (
              <section className="onb-review-section" key={role.title}>
                <h2>{role.title}</h2>
                <p>
                  {role.support === "direct"
                    ? "Direct experience shown"
                    : "Transferable experience"}{" "}
                  · {role.experienceLevel || "Level needs clarification"}
                </p>
                <ul>
                  {role.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
                {role.uncertainty && <p>{role.uncertainty}</p>}
                <References result={result} ids={role.evidenceIds} />
                <small>
                  Suggested direction — you choose what to pursue next.
                </small>
              </section>
            ))}
          </div>
          <details>
            <summary>CV feedback and source references</summary>
            {result.findings.map((finding, i) => (
              <section key={i}>
                <h3>{finding.dimension}</h3>
                <p>{finding.observation}</p>
                <p>{finding.action}</p>
              </section>
            ))}
            {result.evidence.map((e) => (
              <blockquote key={e.id}>
                <small>
                  {e.id} · {e.section}
                </small>
                <p>{e.quote}</p>
              </blockquote>
            ))}
          </details>
          <p className="onb-hint">
            {result.model} · {new Date(result.createdAt).toLocaleDateString()} ·
            Source-linked proposals, awaiting your review
          </p>
        </>
      )}
      <div>
        <p className="onb-hint">
          {result ? "Refreshing sends" : "Analyze sends"} the extracted text to
          your connected model. Your original stays on this device. Review each
          proposal before using it.
        </p>
        <Button
          type="button"
          className={result ? "onb-text" : "onb-primary"}
          disabled={
            analysis.status === "running" ||
            !cv.sections.some((s) => s.text.trim())
          }
          onClick={() => void analyzeCv()}
        >
          {analysis.status === "running"
            ? "Analyzing your CV…"
            : result
              ? "Refresh analysis"
              : analysisAvailable
                ? "Analyze my CV"
                : "Retry analysis connection"}
        </Button>
      </div>
      <details>
        <summary>View original and extracted text</summary>
        {data.original && (
          <Button
            type="button"
            className="onb-text"
            onClick={() => downloadOriginal(data.original!, cv.name)}
          >
            Save original
          </Button>
        )}
        <div
          className="onb-source-text"
          tabIndex={0}
          aria-label="Extracted CV text"
        >
          {cv.sections.map((section) => (
            <section key={section.label}>
              <h2>{section.label}</h2>
              <p>{section.text}</p>
            </section>
          ))}
        </div>
        {cv.warnings.map((warning, i) => (
          <p className="onb-warning" key={i}>
            {warning}
          </p>
        ))}
      </details>
    </div>
  );
}
