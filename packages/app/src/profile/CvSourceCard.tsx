import { Button } from "@base-ui/react/button";
import { Download, FileText } from "lucide-react";
import { downloadOriginal } from "../onboarding/cv.ts";
import { useProfile } from "../onboarding/ProfileProvider.tsx";
import type { Step } from "../onboarding/model.ts";
import { ProfileSection } from "./ProfileSection.tsx";

interface CvSourceCardProps {
  onEdit: (step: Step) => void;
}
export function CvSourceCard({ onEdit }: CvSourceCardProps) {
  const { data } = useProfile();
  const cv = data?.profile.cv;
  return (
    <ProfileSection
      id="source"
      title="Your original CV"
      onEdit={() => onEdit("cv")}
    >
      {cv ? (
        <>
          <div className="candidate-source">
            <span className="candidate-source-icon">
              <FileText size={25} aria-hidden="true" />
            </span>
            <div>
              <strong>{cv.name}</strong>
              <p className="candidate-muted">
                {cv.format.toUpperCase()} · Added{" "}
                {new Date(cv.importedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="candidate-actions">
            <Button
              className="button"
              disabled={!data.original}
              onClick={() => {
                if (data.original) downloadOriginal(data.original, cv.name);
              }}
            >
              <Download size={14} aria-hidden="true" /> Save original file
            </Button>
            <Button className="candidate-link" onClick={() => onEdit("cv")}>
              Replace CV
            </Button>
          </div>
          {cv.warnings.length > 0 && (
            <div className="candidate-notice">
              <strong>Extraction limits</strong>
              <ul>
                {cv.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="candidate-disclosure">
            <summary>Source details & extracted text</summary>
            <p className="candidate-muted">
              Original retained unchanged. Extracted text is source material,
              not confirmation of its claims.
            </p>
            <dl className="candidate-source-meta">
              <dt>Imported</dt>
              <dd>{new Date(cv.importedAt).toLocaleString()}</dd>
              <dt>SHA-256</dt>
              <dd>
                <code>{cv.hash}</code>
              </dd>
            </dl>
            {cv.sections.map((section, index) => (
              <details key={index}>
                <summary>{section.label}</summary>
                <pre>{section.text}</pre>
              </details>
            ))}
          </details>
        </>
      ) : (
        <div className="candidate-empty">
          <FileText size={26} aria-hidden="true" />
          <p>Add your CV to bring your career history into focus.</p>
          <Button className="button" onClick={() => onEdit("cv")}>
            Add your CV
          </Button>
          <small>You can keep editing your preferences without one.</small>
        </div>
      )}
      <p className="candidate-footnote">
        Replacing the source keeps your preferences and confirmed corrections.
        Your original document is never rewritten.
      </p>
    </ProfileSection>
  );
}
