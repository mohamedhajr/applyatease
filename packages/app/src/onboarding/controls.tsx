import type { ReactNode } from "react";
import { Check } from "lucide-react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="onb-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Choice<T extends string>({
  name,
  value,
  selected,
  onChange,
  title,
  detail,
  multiple = false,
}: {
  name: string;
  value: T;
  selected: boolean;
  onChange: (value: T) => void;
  title: string;
  detail?: string;
  multiple?: boolean;
}) {
  return (
    <label className="onb-choice" data-selected={selected}>
      <input
        type={multiple ? "checkbox" : "radio"}
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      <span className="onb-choice-copy">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      <span
        className={
          multiple ? "onb-choice-indicator square" : "onb-choice-indicator"
        }
        aria-hidden="true"
      >
        {selected && <Check size={13} />}
      </span>
    </label>
  );
}
