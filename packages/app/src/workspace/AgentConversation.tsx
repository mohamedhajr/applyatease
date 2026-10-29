import { Button } from "@base-ui/react/button";
import { PanelRight, PanelRightClose, Sprout } from "lucide-react";
import type { Ref } from "react";
import { WorkflowActions } from "./WorkflowActions.tsx";
import { useWorkflow } from "./WorkflowProvider.tsx";

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
  const workflow = useWorkflow();
  const job = workflow.data.opportunities.find(
    (item) => item.id === workflow.data.selectedId,
  );
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
          <p>
            {job?.assessment?.result.title ||
              (job ? "Imported opportunity" : "Search, inspect and prepare")}
          </p>
        </div>
        <span className="context-label">Local workspace</span>
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
        <WorkflowActions job={job} />
      </div>
    </section>
  );
}
