import { Button } from "@base-ui/react/button";
import {
  ArrowDownWideNarrow,
  ArrowUpRight,
  Bookmark,
  Inbox,
  ListFilter,
  MessageSquare,
  PanelRight,
  Search,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AgentConversation } from "./AgentConversation.tsx";
import { OpportunityDetails } from "./OpportunityDetails.tsx";

const views = {
  all: {
    title: "All opportunities",
    empty: "Your next opportunity starts here",
    description:
      "Your jobs will appear here, each with its own conversation and match details.",
  },
  saved: {
    title: "Saved jobs",
    empty: "A home for your shortlist",
    description: "Opportunities you save will stay together here.",
  },
  review: {
    title: "Needs review",
    empty: "Your review queue starts here",
    description:
      "Opportunities with questions or materials to review will appear here.",
  },
  archived: {
    title: "Archived",
    empty: "Keep your workspace focused",
    description: "Archived opportunities will remain available here.",
  },
} as const;
type Panel = "opportunities" | "conversation" | "details";

export function OpportunityWorkspace({ view }: { view: keyof typeof views }) {
  const [activePanel, setActivePanel] = useState<Panel>("opportunities");
  const conversationHeading = useRef<HTMLHeadingElement>(null);
  const detailsPanel = useRef<HTMLElement>(null);
  const [detailsVisible, setDetailsVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const current = views[view];
  function showDetails() {
    setDetailsVisible(true);
    setActivePanel("details");
    requestAnimationFrame(() => detailsPanel.current?.focus());
  }
  function hideDetails() {
    setDetailsVisible(false);
    setActivePanel("conversation");
    requestAnimationFrame(() => conversationHeading.current?.focus());
  }
  return (
    <div
      className="opportunity-workspace"
      data-panel={activePanel}
      data-details={detailsVisible}
    >
      <div
        className="panel-switcher"
        role="group"
        aria-label="Workspace panels"
      >
        <Button
          aria-pressed={activePanel === "opportunities"}
          onClick={() => setActivePanel("opportunities")}
        >
          <Inbox size={16} aria-hidden="true" />
          Opportunities
        </Button>
        <Button
          aria-pressed={activePanel === "conversation"}
          onClick={() => setActivePanel("conversation")}
        >
          <MessageSquare size={16} aria-hidden="true" />
          Chat
        </Button>
        <Button aria-pressed={activePanel === "details"} onClick={showDetails}>
          <PanelRight size={16} aria-hidden="true" />
          Details
        </Button>
      </div>
      <section
        className="opportunity-list panel"
        aria-label="Job opportunities"
      >
        <header className="panel-header">
          <h1>{current.title}</h1>
          <span className="count-badge">0</span>
          <Button
            className="icon-button header-end"
            aria-label="Filter opportunities"
            aria-expanded={filtersOpen}
            aria-controls="opportunity-filters"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <ListFilter size={17} />
          </Button>
        </header>
        <div className="list-tools">
          <label className="search-field">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Search opportunities"
              placeholder="Search opportunities"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <Button
                className="clear-search"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={13} />
              </Button>
            )}
          </label>
          <div className="list-controls">
            <span>
              <span className="status-dot" />
              {status === "all"
                ? "All statuses"
                : status === "unassessed"
                  ? "Not assessed"
                  : "Needs review"}
            </span>
            <label className="sort-field">
              <ArrowDownWideNarrow size={13} aria-hidden="true" />
              <select
                aria-label="Sort opportunities"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Recent</option>
                <option value="company">Company</option>
                <option value="score">Match score</option>
              </select>
            </label>
          </div>
        </div>
        {filtersOpen && (
          <div id="opportunity-filters" className="filter-panel">
            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="unassessed">Not assessed</option>
                <option value="review">Needs review</option>
              </select>
            </label>
            <Button
              className="text-button"
              onClick={() => {
                setStatus("all");
                setQuery("");
              }}
            >
              Reset filters
            </Button>
          </div>
        )}
        <div className="list-empty" role="status">
          <span className="empty-symbol">
            <Inbox size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2>
            {query
              ? "No matching opportunities"
              : status !== "all"
                ? "No opportunities in this view"
                : current.empty}
          </h2>
          <p>
            {query
              ? "Try a different search or clear your filters."
              : current.description}
          </p>
          {query || status !== "all" ? (
            <Button
              className="text-button"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Link to="/profile" className="text-link">
              Your profile <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="list-footer">
          <Bookmark size={14} aria-hidden="true" />
          <span>Job discovery and import are coming next.</span>
        </div>
      </section>
      <AgentConversation
        headingRef={conversationHeading}
        onShowDetails={showDetails}
        detailsVisible={detailsVisible}
        onHideDetails={hideDetails}
      />
      <OpportunityDetails panelRef={detailsPanel} onClose={hideDetails} />
    </div>
  );
}
