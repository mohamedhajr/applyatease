import { Button } from "@base-ui/react/button";
import {
  ArrowUp,
  FileSearch,
  Flag,
  MessageSquare,
  PanelRight,
  PanelRightClose,
  PencilLine,
  Sprout,
  TextSearch,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Ref } from "react";

const suggestions = [
  {
    label: "Understand my match",
    text: "Help me understand how my experience matches this opportunity.",
    icon: TextSearch,
  },
  {
    label: "Prepare my application",
    text: "Help me review the requirements and prepare an application for this opportunity.",
    icon: FileSearch,
  },
  {
    label: "Review flagged questions",
    text: "Help me review the questions that need my confirmation before applying.",
    icon: Flag,
  },
];

export function AgentConversation({
  headingRef,
  onShowDetails,
  onHideDetails,
  detailsVisible,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  onShowDetails: () => void;
  onHideDetails: () => void;
  detailsVisible: boolean;
}) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  return (
    <section className="conversation panel" aria-label="Agent conversation">
      <header className="panel-header conversation-header">
        <span className="agent-avatar">
          <Sprout size={20} aria-hidden="true" />
        </span>
        <div className="conversation-identity">
          <h2 ref={headingRef} tabIndex={-1}>
            Career agent
          </h2>
          <p>No opportunity selected</p>
        </div>
        <span className="context-label">Your workspace</span>
        <Button
          className="icon-button details-toggle"
          aria-label={
            detailsVisible
              ? "Hide opportunity details"
              : "Show opportunity details"
          }
          onClick={detailsVisible ? onHideDetails : onShowDetails}
        >
          <PanelRightClose size={17} />
        </Button>
        <Button
          className="icon-button compact-details-toggle"
          aria-label="Show opportunity details"
          onClick={onShowDetails}
        >
          <PanelRight size={17} />
        </Button>
      </header>
      <div className="conversation-body">
        <div className="conversation-empty">
          <span className="agent-emblem">
            <Sprout size={30} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="section-kicker">A little clarity for your next move</p>
          <h2>
            Every opportunity.
            <br />
            One conversation.
          </h2>
          <p>
            Bring the role, your experience and the next steps together. This is
            where you’ll work through each opportunity with your agent.
          </p>
          <div
            className="conversation-suggestions"
            aria-label="Draft a message"
          >
            {suggestions.map(({ label, text, icon: Icon }) => (
              <Button
                key={label}
                onClick={() => {
                  setDraft(text);
                  input.current?.focus();
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                <span className="suggestion-arrow" aria-hidden="true">
                  ↗
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="composer-area">
        <div className="composer">
          <div className="composer-heading">
            <span>
              <MessageSquare size={15} aria-hidden="true" />
              Message agent
            </span>
            <span className="draft-label">
              <PencilLine size={12} aria-hidden="true" />
              Draft
            </span>
          </div>
          <textarea
            ref={input}
            aria-label="Message draft"
            aria-describedby="agent-availability"
            placeholder="Ask about a role, your match or the next step…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="composer-footer">
            <span className="composer-context">
              <Sprout size={14} aria-hidden="true" />
              Career agent
            </span>
            <Button
              className="send-button"
              aria-label="Send message — agent not connected"
              disabled
            >
              <ArrowUp size={18} />
            </Button>
          </div>
        </div>
        <p id="agent-availability" className="composer-notice">
          Agent chat isn’t connected yet. Your draft stays here until you leave
          this page.
        </p>
      </div>
    </section>
  );
}
