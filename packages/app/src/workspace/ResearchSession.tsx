import { createContext, useContext, useState, type ReactNode } from "react";

type ResearchEntry = { id: string; name: string; sourceUrl: string };
type Session = {
  key: string;
  researchOnly: boolean;
  entry: ResearchEntry | null;
  updateEntry: (
    patch: Partial<Pick<ResearchEntry, "name" | "sourceUrl">>,
  ) => void;
};
const Context = createContext<Session | null>(null);
const catalogKey = "applyatease-research-catalog-v1";
function readCatalog(): ResearchEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(catalogKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is ResearchEntry =>
        !!entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        /^research:[a-f0-9-]+$/.test(entry.id) &&
        typeof entry.name === "string" &&
        typeof entry.sourceUrl === "string",
    );
  } catch {
    return [];
  }
}
export function ResearchSession({
  personalKey,
  children,
}: {
  personalKey: string;
  children: ReactNode;
}) {
  const [entries, setEntries] = useState(readCatalog);
  const [selected, setSelected] = useState(() => {
    try {
      return sessionStorage.getItem("applyatease-research-selection") ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState("");
  const entry = entries.find((value) => value.id === selected) ?? null;
  function save(next: ResearchEntry[]) {
    try {
      localStorage.setItem(catalogKey, JSON.stringify(next));
      setEntries(next);
      setError("");
    } catch {
      setError(
        "Research profile details could not be saved. Check local storage and retry.",
      );
    }
  }
  function choose(id: string) {
    try {
      sessionStorage.setItem("applyatease-research-selection", id);
      setSelected(id);
    } catch {
      setError("The selected research session could not be saved.");
    }
  }
  return (
    <Context.Provider
      value={{
        key: entry?.id ?? personalKey,
        researchOnly: !!entry,
        entry,
        updateEntry: (patch) => {
          if (entry)
            save(
              entries.map((item) =>
                item.id === entry.id ? { ...item, ...patch } : item,
              ),
            );
        },
      }}
    >
      <div
        className={entry ? "research-session is-research" : "research-session"}
      >
        <a
          className="skip-link"
          href="#main"
          onClick={(event) => {
            const main = document.getElementById("main");
            if (main) {
              event.preventDefault();
              main.focus();
            }
          }}
        >
          Skip to content
        </a>
        <div className="research-session-bar" aria-label="Workspace mode">
          <strong>
            {entry
              ? "Local research · no applicant authorization"
              : "Personal workspace"}
          </strong>
          <label>
            <span className="sr-only">Select workspace</span>
            <select
              aria-label="Select workspace"
              value={entry?.id ?? ""}
              onChange={(event) => choose(event.target.value)}
            >
              <option value="">Personal workspace</option>
              {entries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const id = `research:${crypto.randomUUID()}`;
              const next = [
                ...entries,
                {
                  id,
                  name: `Research profile ${entries.length + 1}`,
                  sourceUrl: "",
                },
              ];
              try {
                localStorage.setItem(catalogKey, JSON.stringify(next));
                setEntries(next);
                choose(id);
                setError("");
              } catch {
                setError(
                  "A research profile could not be created. Check local storage and retry.",
                );
              }
            }}
          >
            New research profile
          </button>
          {entry && (
            <button
              type="button"
              className="text-button"
              onClick={() => choose("")}
            >
              Exit research
            </button>
          )}
          {error && <span role="alert">{error}</span>}
        </div>
        <div className="research-session-content">{children}</div>
      </div>
    </Context.Provider>
  );
}
export function useWorkspaceSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace session is required.");
  return value;
}
