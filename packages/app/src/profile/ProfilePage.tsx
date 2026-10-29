import { Button } from "@base-ui/react/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, HardDrive } from "lucide-react";
import { useRef, useState } from "react";
import { emptyProfile, type Step } from "../onboarding/model.ts";
import { useProfile } from "../onboarding/ProfileProvider.tsx";
import { SaveStatus } from "../onboarding/ProfileReview.tsx";
import notices from "../onboarding/THIRD_PARTY_NOTICES.txt?url";
import { CareerEvidence, type FactDecision } from "./CareerEvidence.tsx";
import { CareerSnapshot, currentAnalysis } from "./CareerSnapshot.tsx";
import { CompletionCard } from "./CompletionCard.tsx";
import { CvSourceCard } from "./CvSourceCard.tsx";
import { ProfileEditor } from "./ProfileEditor.tsx";
import { RoleDirections } from "./RoleDirections.tsx";
import { WorkPreferences } from "./WorkPreferences.tsx";
import "../onboarding/onboarding.css";
import "./profile.css";

export function ProfilePage() {
  const {
    data,
    update,
    removeCv,
    status,
    analyzeCv,
    analysisAvailable,
    analysisAvailabilityMessage,
  } = useProfile();
  const [editing, setEditing] = useState<Step | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  function edit(step: Step) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEditing(step);
  }
  function decide(decision: FactDecision) {
    if (!data) return;
    update({
      corrections: [
        ...data.profile.corrections.filter(
          (item) =>
            !(
              item.factId === decision.factId &&
              item.sourceHash === decision.sourceHash
            ),
        ),
        decision,
      ],
    });
  }
  const p = data?.profile;
  const analysis = p ? currentAnalysis(p) : null;
  return (
    <section className="page-panel">
      <header className="panel-header">
        <h1>Your profile</h1>
        <SaveStatus />
      </header>
      {!p ? (
        <div className="candidate-page">
          <SaveStatus detailed />
        </div>
      ) : (
        <div className="candidate-page">
          <div className="candidate-hero">
            <div>
              <p className="candidate-eyebrow">
                A starting point that grows with you
              </p>
              <h2>Your experience. Your next move.</h2>
              <p>
                Keep your career details and preferences in one place. Change
                any part as your plans evolve.
              </p>
            </div>
            <Link to="/" className="button">
              Open workspace <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {!p.setupCompletedAt && !p.confirmedAt && (
            <div className="candidate-setup">
              <span>Prefer a guided start?</span>
              <Link to="/onboarding" className="candidate-link">
                {p.updatedAt ? "Resume setup" : "Set up your profile"}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <span className="candidate-muted">
                Or edit any section below.
              </span>
            </div>
          )}
          {p.setupCompletedAt && (
            <p className="candidate-saved-note">
              Search profile saved locally. Keep refining it here; search isn’t
              connected yet.
            </p>
          )}
          {status === "error" && <SaveStatus detailed />}
          {analysisError && (
            <p className="onb-error" role="alert">
              {analysisError}
            </p>
          )}
          <div className="candidate-grid">
            <div className="candidate-main">
              <CareerSnapshot
                profile={p}
                analysis={analysis}
                available={analysisAvailable}
                availabilityMessage={analysisAvailabilityMessage}
                onEdit={edit}
                onAnalyze={() => {
                  setAnalysisError("");
                  void analyzeCv().catch((error: unknown) =>
                    setAnalysisError(
                      error instanceof Error
                        ? error.message
                        : "Analysis could not start. Try again.",
                    ),
                  );
                }}
              />
              <RoleDirections
                profile={p}
                analysis={analysis}
                onEdit={edit}
                update={update}
              />
              <CareerEvidence
                analysis={analysis}
                sourceHash={p.cv?.hash ?? ""}
                corrections={p.corrections}
                history={p.analysisHistory}
                onDecide={decide}
              />
              <WorkPreferences profile={p} onEdit={edit} />
            </div>
            <aside
              className="candidate-aside"
              aria-label="Profile progress and source"
            >
              <CompletionCard profile={p} onEdit={edit} />
              <CvSourceCard onEdit={edit} />
            </aside>
          </div>
          <footer className="candidate-footer">
            <div>
              <HardDrive size={16} aria-hidden="true" />
              <p>
                Saved only in this browser or desktop app on this device.
                Clearing its data removes the profile. Your original CV stays
                intact; no employer has received your information.
              </p>
            </div>
            <div className="candidate-actions">
              <a
                className="candidate-link"
                href={notices}
                download="cv-reader-notices.txt"
              >
                CV reader license notices
              </a>
              <Button
                className="candidate-link"
                onClick={() => setDeleting(!deleting)}
              >
                {deleting ? "Keep profile" : "Clear local profile"}
              </Button>
            </div>
            {deleting && (
              <div className="candidate-notice">
                <p>
                  Remove this local profile and its stored CV? Your source file
                  outside the app won’t change.
                </p>
                <Button
                  className="candidate-link"
                  onClick={() => {
                    removeCv();
                    update({ ...emptyProfile(), roleDrafts: {} }, null, true);
                    setDeleting(false);
                  }}
                >
                  Remove local profile
                </Button>
              </div>
            )}
          </footer>
          {editing && (
            <ProfileEditor
              key={editing}
              step={editing}
              onClose={() => setEditing(null)}
              returnFocus={returnFocus}
            />
          )}
        </div>
      )}
    </section>
  );
}
