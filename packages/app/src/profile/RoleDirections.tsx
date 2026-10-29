import { Button } from "@base-ui/react/button";
import { Plus, X } from "lucide-react";
import type { CvAnalysis } from "@applyatease/contracts/career";
import {
  experienceStep,
  levelStep,
  newRole,
  type Profile,
  type Step,
} from "../onboarding/model.ts";
import { EvidenceReferences } from "./CareerEvidence.tsx";
import { DetailRow, ProfileSection } from "./ProfileSection.tsx";

interface RoleDirectionsProps {
  profile: Profile;
  analysis: CvAnalysis | null;
  onEdit: (step: Step) => void;
  update: (patch: Partial<Profile>) => void;
}
export function RoleDirections({
  profile,
  analysis,
  onEdit,
  update,
}: RoleDirectionsProps) {
  return (
    <ProfileSection
      id="directions"
      title="Your next directions"
      description="Choose where you want to go. Your aspirations can differ from your past roles."
      onEdit={() => onEdit("roles")}
    >
      {profile.roles.length ? (
        <div>
          {profile.roles.map((role) => {
            const suggestion = analysis?.roles.find(
              (item) => item.title.toLowerCase() === role.title.toLowerCase(),
            );
            return (
              <article className="candidate-role" key={role.title}>
                <div className="candidate-role-header">
                  <h3>{role.title}</h3>
                  <Button
                    className="candidate-edit"
                    aria-label={`Remove ${role.title} from target roles`}
                    onClick={() =>
                      update({
                        roles: profile.roles.filter(
                          (item) => item.title !== role.title,
                        ),
                      })
                    }
                  >
                    <X size={13} aria-hidden="true" /> Remove
                  </Button>
                </div>
                <span className="candidate-badge" data-state="provided">
                  Selected by you
                </span>
                <dl className="candidate-detail-rows">
                  <DetailRow
                    label="Your experience"
                    onEdit={() => onEdit(experienceStep(role.title))}
                  >
                    {role.experienceLevel ||
                      suggestion?.experienceLevel ||
                      "Not provided"}
                    <small className="candidate-role-origin">
                      {role.experienceConfirmedAt
                        ? "Self-reported by you"
                        : suggestion?.experienceLevel
                          ? "Suggested from CV · needs confirmation"
                          : "You can explore this direction without a career interview."}
                    </small>
                  </DetailRow>
                  <DetailRow
                    label="Desired level"
                    onEdit={() => onEdit(levelStep(role.title))}
                  >
                    {role.level || "Open — not set"}
                  </DetailRow>
                </dl>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="candidate-muted">No target roles selected yet.</p>
      )}
      <Button className="candidate-link" onClick={() => onEdit("roles")}>
        <Plus size={14} aria-hidden="true" /> Add or change a direction
      </Button>
      {analysis && analysis.roles.length > 0 && (
        <details className="candidate-disclosure" open={!profile.roles.length}>
          <summary>Suggested from your CV · {analysis.roles.length}</summary>
          <p className="candidate-muted">
            Suggestions are interpretations. Selecting one records a preference,
            not a qualification.
          </p>
          {analysis.roles.map((role) => {
            const selected = profile.roles.some(
              (item) => item.title.toLowerCase() === role.title.toLowerCase(),
            );
            return (
              <article className="candidate-evidence-item" key={role.title}>
                <div className="candidate-role-header">
                  <h3>{role.title}</h3>
                  <span className="candidate-badge">
                    {role.support === "direct"
                      ? "Direct evidence"
                      : "Transferable evidence"}
                  </span>
                </div>
                {role.reasons.map((reason, index) => (
                  <p key={index}>{reason}</p>
                ))}
                {role.experienceLevel && (
                  <p className="candidate-footnote">
                    Suggested experience: {role.experienceLevel} · unconfirmed
                  </p>
                )}
                {role.uncertainty && (
                  <p className="candidate-footnote">{role.uncertainty}</p>
                )}
                <EvidenceReferences
                  analysis={analysis}
                  ids={role.evidenceIds}
                />
                <div className="candidate-actions">
                  <Button
                    className="button"
                    disabled={selected}
                    onClick={() =>
                      update({ roles: [...profile.roles, newRole(role.title)] })
                    }
                  >
                    {selected ? "Selected" : "Explore this direction"}
                  </Button>
                </div>
              </article>
            );
          })}
        </details>
      )}
    </ProfileSection>
  );
}
