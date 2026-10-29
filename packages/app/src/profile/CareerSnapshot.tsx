import { Button } from "@base-ui/react/button";
import { FileSearch, RefreshCw } from "lucide-react";
import type { CvAnalysis } from "@applyatease/contracts/career";
import {
  effectiveAnalysis,
  type Profile,
  type Step,
} from "../onboarding/model.ts";
import { EvidenceReferences } from "./CareerEvidence.tsx";
import { ProfileSection } from "./ProfileSection.tsx";

export function currentAnalysis(profile: Profile): CvAnalysis | null {
  const result = profile.analysis.result;
  return result &&
    result.sourceHash === profile.cv?.hash &&
    (profile.analysis.status === "ready" ||
      profile.analysis.status === "partial")
    ? effectiveAnalysis(profile)
    : null;
}
const statusLabels: Record<Profile["analysis"]["status"], string> = {
  idle: "Not analyzed yet",
  running: "Analysis in progress",
  ready: "Analysis available",
  partial: "Partial analysis",
  failed: "Analysis couldn’t finish",
  unavailable: "Analysis unavailable",
};
interface CareerSnapshotProps {
  profile: Profile;
  analysis: CvAnalysis | null;
  available: boolean;
  availabilityMessage: string;
  onAnalyze: () => void;
  onEdit: (step: Step) => void;
}
export function CareerSnapshot({
  profile,
  analysis,
  available,
  availabilityMessage,
  onAnalyze,
  onEdit,
}: CareerSnapshotProps) {
  return (
    <ProfileSection id="snapshot" title="Your career snapshot">
      <div className="candidate-tags">
        <span className="candidate-badge" role="status">
          {profile.cv ? statusLabels[profile.analysis.status] : "No CV added"}
        </span>
        {analysis && (
          <span className="candidate-badge">
            AI interpretation · review with your source
          </span>
        )}
      </div>
      {analysis ? (
        <>
          <div className="candidate-snapshot-copy">
            {analysis.snapshot.map((claim, index) => (
              <div key={index}>
                <p>{claim.text}</p>
                <EvidenceReferences
                  analysis={analysis}
                  ids={claim.evidenceIds}
                />
              </div>
            ))}
          </div>
          {analysis.limitations.length > 0 && (
            <div className="candidate-notice">
              <strong>What this analysis could cover</strong>
              <ul>
                {analysis.limitations.map((limitation, index) => (
                  <li key={index}>{limitation}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="candidate-disclosure">
            <summary>CV findings · {analysis.findings.length}</summary>
            {analysis.findings.map((finding, index) => (
              <article className="candidate-evidence-item" key={index}>
                <h3>{finding.dimension}</h3>
                <p>{finding.observation}</p>
                {finding.action && (
                  <p className="candidate-footnote">
                    Suggested next step: {finding.action}
                  </p>
                )}
                <EvidenceReferences
                  analysis={analysis}
                  ids={finding.evidenceIds}
                />
              </article>
            ))}
            <p className="candidate-footnote">
              Findings describe the document. Missing evidence doesn’t establish
              a missing ability.
            </p>
          </details>
          <details className="candidate-disclosure">
            <summary>Analysis details</summary>
            <p className="candidate-muted">
              {analysis.model} · {new Date(analysis.createdAt).toLocaleString()}
            </p>
            <p className="candidate-footnote">
              Source sections covered:{" "}
              {analysis.coverage.join(", ") || "Not reported"}. Instruction
              version: {analysis.instructionVersion}.
            </p>
          </details>
        </>
      ) : (
        <div className="candidate-snapshot-empty">
          <FileSearch size={30} aria-hidden="true" />
          <p>
            {profile.cv
              ? "Your CV is retained. A career snapshot will appear here when analysis succeeds."
              : "Your experience, in focus."}
          </p>
          <p className="candidate-muted">
            {profile.cv
              ? profile.analysis.message ||
                availabilityMessage ||
                "You can keep editing your profile while analysis is unavailable."
              : "Add your CV for source-backed career details, or start with the roles you want next."}
          </p>
        </div>
      )}
      {profile.cv && profile.analysis.message && analysis && (
        <p className="candidate-footnote">{profile.analysis.message}</p>
      )}
      <div className="candidate-actions">
        {profile.cv ? (
          <Button
            className="button"
            disabled={
              profile.analysis.status === "running" ||
              !profile.cv.sections.some((section) => section.text.trim())
            }
            onClick={onAnalyze}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {profile.analysis.status === "running"
              ? "Analyzing…"
              : analysis
                ? "Refresh analysis"
                : available
                  ? "Analyze CV"
                  : "Retry analysis connection"}
          </Button>
        ) : (
          <Button className="button" onClick={() => onEdit("cv")}>
            Add your CV
          </Button>
        )}
        {profile.cv && (
          <Button className="candidate-link" onClick={() => onEdit("cv-notes")}>
            Add a CV note
          </Button>
        )}
      </div>
      {profile.cv && (
        <p className="candidate-footnote">
          Analysis sends extracted CV text to your connected AI service. Your
          original file stays unchanged.
        </p>
      )}
      {analysis &&
        profile.corrections.some(
          (item) => item.sourceHash === analysis.sourceHash,
        ) && (
          <p className="candidate-footnote">
            This snapshot interprets the original source. Your confirmed
            corrections are kept separately in Career details.
          </p>
        )}
      {profile.cv && !available && !analysis && (
        <p className="candidate-footnote">
          {availabilityMessage ||
            "Connect a supported analysis service to analyze this CV."}
        </p>
      )}
      {profile.cv?.notes && (
        <div className="candidate-notice">
          <strong>Your CV notes</strong>
          <p>{profile.cv.notes}</p>
        </div>
      )}
    </ProfileSection>
  );
}
