import { Button } from "@base-ui/react/button";
import type { CvAnalysis, FactProposal } from "@applyatease/contracts/career";
import { useState } from "react";
import type { Profile } from "../onboarding/model.ts";
import { Field } from "../onboarding/controls.tsx";
import { ProfileSection } from "./ProfileSection.tsx";

export type FactDecision = Profile["corrections"][number];
interface EvidenceReferencesProps {
  analysis: CvAnalysis;
  ids: readonly string[];
}
export function EvidenceReferences({ analysis, ids }: EvidenceReferencesProps) {
  const evidence = analysis.evidence.filter((item) => ids.includes(item.id));
  if (!evidence.length) return null;
  return (
    <details className="candidate-evidence-reference">
      <summary>View source evidence</summary>
      {evidence.map((item) => (
        <blockquote key={item.id}>
          <strong>{item.section}</strong>
          <p>{item.quote}</p>
        </blockquote>
      ))}
    </details>
  );
}
interface FactItemProps {
  fact: FactProposal;
  analysis: CvAnalysis;
  decision: FactDecision | undefined;
  onDecide: (decision: FactDecision) => void;
}
function FactItem({ fact, analysis, decision, onDecide }: FactItemProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(decision?.value ?? fact.value);
  function decide(status: FactDecision["status"], nextValue: string) {
    onDecide({
      factId: fact.id,
      sourceHash: analysis.sourceHash,
      value: nextValue.trim(),
      status,
      confirmedAt: new Date().toISOString(),
    });
    setEditing(false);
  }
  return (
    <article className="candidate-evidence-item">
      <div className="candidate-role-header">
        <h3>{fact.label}</h3>
        <span
          className="candidate-badge"
          data-state={
            decision?.status === "candidate_confirmed"
              ? "confirmed"
              : "provisional"
          }
        >
          {decision?.status === "candidate_confirmed"
            ? "Confirmed by you"
            : decision?.status === "candidate_denied"
              ? "Marked incorrect"
              : "From your CV"}
        </span>
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) decide("candidate_confirmed", value);
          }}
        >
          <Field
            label={`Correct ${fact.label}`}
            hint="This updates your profile, keeping the original CV unchanged."
          >
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={3}
            />
          </Field>
          <div className="candidate-actions">
            <Button type="submit" className="button" disabled={!value.trim()}>
              Save correction
            </Button>
            <Button
              type="button"
              className="candidate-link"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p
            className={
              decision?.status === "candidate_denied"
                ? "candidate-muted"
                : undefined
            }
          >
            {decision?.value ?? fact.value}
          </p>
          {fact.uncertainty && (
            <p className="candidate-footnote">
              Needs clarification: {fact.uncertainty}
            </p>
          )}
          <div className="candidate-actions">
            {!decision && (
              <Button
                className="candidate-link"
                onClick={() => decide("candidate_confirmed", fact.value)}
              >
                Confirm this detail
              </Button>
            )}
            <Button
              className="candidate-link"
              onClick={() => {
                setValue(decision?.value ?? fact.value);
                setEditing(true);
              }}
            >
              Correct detail
            </Button>
            {decision?.status !== "candidate_denied" && (
              <Button
                className="candidate-link"
                onClick={() =>
                  decide("candidate_denied", decision?.value ?? fact.value)
                }
              >
                Mark incorrect
              </Button>
            )}
          </div>
        </>
      )}
      <EvidenceReferences analysis={analysis} ids={fact.evidenceIds} />
    </article>
  );
}
const groups: { kinds: readonly FactProposal["kind"][]; label: string }[] = [
  { kinds: ["experience"], label: "Experience" },
  { kinds: ["skill"], label: "Skills" },
  { kinds: ["project"], label: "Projects" },
  { kinds: ["education", "credential"], label: "Education & credentials" },
  { kinds: ["contact", "link"], label: "Contact & links" },
  { kinds: ["residence"], label: "Location in your CV" },
];
interface CareerEvidenceProps {
  analysis: CvAnalysis | null;
  sourceHash: string;
  corrections: readonly FactDecision[];
  history: readonly CvAnalysis[];
  onDecide: (decision: FactDecision) => void;
}
export function CareerEvidence({
  analysis,
  sourceHash,
  corrections,
  history,
  onDecide,
}: CareerEvidenceProps) {
  const retained = [
    ...new Map(
      corrections.map((item) => [`${item.sourceHash}:${item.factId}`, item]),
    ).values(),
  ].filter(
    (item) =>
      !(
        item.sourceHash === analysis?.sourceHash &&
        analysis.facts.some((fact) => fact.id === item.factId)
      ),
  );
  return (
    <ProfileSection
      id="career-evidence"
      title="Career details"
      description="Review individual facts when useful. Confirming one detail never confirms the whole CV."
    >
      {analysis ? (
        groups.map(({ kinds, label }) => {
          const facts = analysis.facts.filter((fact) =>
            kinds.includes(fact.kind),
          );
          return facts.length ? (
            <details className="candidate-disclosure" key={label}>
              <summary>
                {label}{" "}
                <span className="candidate-muted">· {facts.length}</span>
              </summary>
              {facts.map((fact) => (
                <FactItem
                  key={`${analysis.sourceHash}:${fact.id}`}
                  fact={fact}
                  analysis={analysis}
                  decision={corrections.findLast(
                    (item) =>
                      item.sourceHash === analysis.sourceHash &&
                      item.factId === fact.id,
                  )}
                  onDecide={onDecide}
                />
              ))}
            </details>
          ) : null;
        })
      ) : (
        <p className="candidate-muted">
          Structured career details will appear after a successful CV analysis.
          Your preferences remain editable.
        </p>
      )}
      {retained.length > 0 && (
        <details className="candidate-disclosure">
          <summary>
            Saved confirmations & corrections · {retained.length}
          </summary>
          <p className="candidate-muted">
            These remain yours. Review them alongside your current CV; they have
            not been silently applied to a different source claim.
          </p>
          {retained.map((item) => {
            const source = history.find(
              (run) =>
                run.sourceHash === item.sourceHash &&
                run.facts.some((fact) => fact.id === item.factId),
            );
            const fact = source?.facts.find(
              (entry) => entry.id === item.factId,
            );
            return (
              <article
                className="candidate-evidence-item"
                key={`${item.sourceHash}:${item.factId}`}
              >
                {!fact && (
                  <>
                    <h3>Saved profile correction</h3>
                    <p>{item.value}</p>
                  </>
                )}
                <span className="candidate-badge">
                  {item.status === "candidate_confirmed"
                    ? "Confirmed by you"
                    : "Marked incorrect"}{" "}
                  ·{" "}
                  {item.sourceHash === sourceHash
                    ? "current source"
                    : "earlier source"}
                </span>
                {source && fact && (
                  <FactItem
                    fact={fact}
                    analysis={source}
                    decision={item}
                    onDecide={onDecide}
                  />
                )}
              </article>
            );
          })}
        </details>
      )}
    </ProfileSection>
  );
}
