import { Button } from "@base-ui/react/button";
import { Tabs } from "@base-ui/react/tabs";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Flag,
  Globe2,
  ListChecks,
  PanelRightClose,
  PencilLine,
  ScanText,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";

function DetailSection({
  title,
  icon: Icon,
  children,
  open = true,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="detail-section" open={open}>
      <summary>
        <Icon size={15} aria-hidden="true" />
        <span>{title}</span>
        <ChevronDown size={14} className="section-chevron" aria-hidden="true" />
      </summary>
      <div className="detail-section-body">{children}</div>
    </details>
  );
}
function DetailRows({ rows }: { rows: readonly string[] }) {
  return (
    <dl className="detail-rows">
      {rows.map((label) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>Not assessed</dd>
        </div>
      ))}
    </dl>
  );
}
export function OpportunityDetails({
  onClose,
  panelRef,
}: {
  onClose: () => void;
  panelRef: Ref<HTMLElement>;
}) {
  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="opportunity-details panel"
      aria-label="Opportunity details"
    >
      <Tabs.Root defaultValue="details" className="details-tabs">
        <header className="panel-header">
          <Tabs.List
            className="detail-tab-list"
            aria-label="Opportunity information"
          >
            <Tabs.Tab value="details">Details</Tabs.Tab>
            <Tabs.Tab value="review">Review</Tabs.Tab>
          </Tabs.List>
          <Button
            className="icon-button header-end"
            aria-label="Close opportunity details"
            onClick={onClose}
          >
            <PanelRightClose size={16} />
          </Button>
        </header>
        <Tabs.Panel value="details" className="details-scroll">
          <div className="detail-intro">
            <span className="company-placeholder">
              <Building2 size={19} aria-hidden="true" />
            </span>
            <div>
              <h2>Opportunity details</h2>
              <p>Select a job to see the full picture.</p>
            </div>
          </div>
          <DetailSection title="Match overview" icon={Target}>
            <div className="match-overview">
              <div
                className="score-placeholder"
                aria-label="Match score not assessed"
              >
                —<small>/ 100</small>
              </div>
              <div>
                <span className="neutral-badge">Not assessed</span>
                <p>
                  A match score needs your profile and the full job
                  requirements.
                </p>
              </div>
            </div>
            <p className="detail-help">
              Evidence of fit, not a hiring prediction.
            </p>
          </DetailSection>
          <DetailSection title="Eligibility" icon={BadgeCheck}>
            <DetailRows
              rows={[
                "Remote location",
                "Employment type",
                "Work authorization",
                "Language & timezone",
              ]}
            />
            <p className="detail-help">
              A match score never overrides an eligibility blocker.
            </p>
          </DetailSection>
          <DetailSection title="Keywords & evidence" icon={ScanText}>
            <div className="evidence-legend">
              <span>
                <i className="evidence-dot direct" />
                Direct match
              </span>
              <span>
                <i className="evidence-dot adjacent" />
                Related
              </span>
              <span>
                <i className="evidence-dot unknown" />
                Unknown
              </span>
            </div>
            <p className="detail-help">
              Keywords will link to evidence in your CV. Unmentioned experience
              stays unknown.
            </p>
          </DetailSection>
          <DetailSection title="Company information" icon={Building2}>
            <dl className="detail-rows">
              <div>
                <dt>Company</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Industry</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>—</dd>
              </div>
            </dl>
          </DetailSection>
          <DetailSection title="Role & source" icon={Globe2}>
            <dl className="detail-rows">
              <div>
                <dt>Location</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Compensation</dt>
                <dd>Not provided</dd>
              </div>
              <div>
                <dt>Source posting</dt>
                <dd>Not added</dd>
              </div>
              <div>
                <dt>Last checked</dt>
                <dd>Not checked</dd>
              </div>
            </dl>
          </DetailSection>
        </Tabs.Panel>
        <Tabs.Panel value="review" className="details-scroll">
          <div className="review-intro">
            <span className="empty-symbol small">
              <ClipboardCheck size={22} aria-hidden="true" />
            </span>
            <h2>Your application review</h2>
            <p>
              See what’s ready, what needs your input and what still needs
              checking.
            </p>
            <span className="neutral-badge">Not assessed</span>
          </div>
          <DetailSection title="Confirm before applying" icon={Flag}>
            <div className="review-callout">
              <strong>No questions assessed yet</strong>
              <p>
                Flagged questions will appear with their exact wording, why they
                matter and what they block.
              </p>
            </div>
            <p className="detail-help">
              Unanswered declarations stay unanswered.
            </p>
          </DetailSection>
          <DetailSection title="Your profile" icon={FileText}>
            <p className="detail-help">
              Missing or conflicting facts will appear here for you to confirm.
            </p>
          </DetailSection>
          <DetailSection title="Drafted answers" icon={PencilLine}>
            <p className="detail-help">
              Proposed answers and changes will appear here for your review.
            </p>
          </DetailSection>
          <DetailSection title="Employer questions" icon={CircleHelp}>
            <p className="detail-help">
              Unclear role requirements and company information stay separate
              from questions only you can answer.
            </p>
          </DetailSection>
          <DetailSection title="Application approval" icon={ListChecks}>
            <p className="detail-help">
              Review the exact documents, answers and destination before
              approving an application. Confirming a fact does not approve
              submission.
            </p>
            <Button className="button approval-button" disabled>
              Review application
            </Button>
          </DetailSection>
        </Tabs.Panel>
      </Tabs.Root>
    </aside>
  );
}
