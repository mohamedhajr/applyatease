import { Button } from "@base-ui/react/button";
import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Field } from "./controls.tsx";

export type Suggestion = { value: string; label: string };
export const suggest = (values: readonly string[]): Suggestion[] =>
  values.map((value) => ({ value, label: value }));
const normalize = (value: string) => value.trim().toLocaleLowerCase();
export function SearchAnswer({
  label,
  placeholder,
  selected,
  options,
  onSelect,
  onRemove,
  onPending,
  multiple = false,
  allowCustom = true,
}: {
  label: string;
  placeholder: string;
  selected: readonly string[];
  options: readonly Suggestion[];
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
  onPending: (pending: boolean) => void;
  multiple?: boolean;
  allowCustom?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = options
    .filter(
      (option) =>
        !selected.some((v) => normalize(v) === normalize(option.value)) &&
        normalize(option.label + " " + option.value).includes(normalize(query)),
    )
    .slice(0, 6);
  const exact = options.find((option) =>
    [option.value, option.label].some((v) => normalize(v) === normalize(query)),
  );
  const canAdd = !!query.trim() && (allowCustom || !!exact);
  function choose(value: string) {
    onSelect(value.trim());
    setQuery("");
    onPending(false);
  }
  return (
    <div className="onb-search-answer">
      {selected.length > 0 && (
        <ul
          className="onb-selected-chips"
          aria-label={`Selected ${label.toLowerCase()}`}
        >
          {selected.map((value) => (
            <li key={value}>
              <span>
                {options.find((o) => o.value === value)?.label ?? value}
              </span>
              <Button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onRemove(value)}
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Field label={label}>
        <span className="onb-search-input">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            maxLength={200}
            onChange={(e) => {
              setQuery(e.target.value);
              onPending(!!e.target.value.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canAdd) choose(exact?.value ?? query);
              }
            }}
          />
        </span>
      </Field>
      {canAdd &&
        !selected.some(
          (v) => normalize(v) === normalize(exact?.value ?? query),
        ) && (
          <Button
            type="button"
            className="onb-use-answer"
            onClick={() => choose(exact?.value ?? query)}
          >
            <Plus size={16} />
            {multiple ? "Add" : "Use"} {exact?.label ?? query.trim()}
          </Button>
        )}
      {(!selected.length || multiple || query) && (
        <div
          className="onb-suggestions"
          role="group"
          aria-label={`${label} suggestions`}
        >
          {filtered.map((option) => (
            <Button
              type="button"
              key={option.value}
              onClick={() => choose(option.value)}
            >
              {option.label}
              <Plus size={15} aria-hidden="true" />
            </Button>
          ))}
        </div>
      )}
      {query && !filtered.length && !canAdd && (
        <p className="onb-hint">
          Choose a supported option from the search results.
        </p>
      )}
      <p className="onb-hint">
        {multiple
          ? "Choose suggestions or type a title and press Enter to add it."
          : "Choose a suggestion or use your typed answer. You can change it later."}
      </p>
    </div>
  );
}
