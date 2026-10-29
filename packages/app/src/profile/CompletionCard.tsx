import { CheckCircle2, Circle, CircleDashed } from "lucide-react";
import type { Profile, Step } from "../onboarding/model.ts";
import { detailStateLabel, profileCompletion } from "./completion.ts";
import { ProfileSection } from "./ProfileSection.tsx";

interface CompletionCardProps {
  profile: Profile;
  onEdit: (step: Step) => void;
}
export function CompletionCard({ profile, onEdit }: CompletionCardProps) {
  const items = profileCompletion(profile);
  const provided = items.filter((item) => item.state === "provided").length;
  const missingBasics = items.filter(
    (item) => item.purpose === "Needed for search" && item.state !== "provided",
  ).length;
  return (
    <ProfileSection id="completion" title="A little more context">
      <p className="candidate-completion-count">
        {provided} <span>of {items.length} relevant details provided</span>
      </p>
      <progress
        className="candidate-progress"
        value={provided}
        max={items.length}
        aria-label={`${provided} of ${items.length} relevant profile details provided`}
      />
      <p className="candidate-footnote">
        {missingBasics
          ? `${missingBasics} search ${missingBasics === 1 ? "detail is" : "details are"} still open.`
          : "Your basic search preferences are provided."}{" "}
        Other details can wait.
      </p>
      <details className="candidate-disclosure">
        <summary>View checklist & edit</summary>
        <ul className="candidate-checklist">
          {items.map((item) => {
            const Icon =
              item.state === "provided"
                ? CheckCircle2
                : item.state === "provisional"
                  ? CircleDashed
                  : Circle;
            return (
              <li key={item.id} data-state={item.state}>
                <Icon size={15} aria-hidden="true" />
                <button
                  onClick={() => onEdit(item.step)}
                  aria-label={`Edit ${item.label} from checklist`}
                >
                  <strong>{item.label}</strong>
                  <span className="candidate-badge" data-state={item.state}>
                    {detailStateLabel[item.state]}
                  </span>
                  <small>
                    {item.purpose} · {item.reason}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      </details>
      <p className="candidate-footnote">
        A count of applicable inputs, not a CV score or permission to apply.
        Search isn’t connected yet.
      </p>
    </ProfileSection>
  );
}
