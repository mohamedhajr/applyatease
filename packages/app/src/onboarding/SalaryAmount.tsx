import { useState } from "react";
import { Button } from "@base-ui/react/button";
import { Field } from "./controls.tsx";
import { salaryRange } from "./model.ts";

export function SalaryAmount({
  value,
  currency,
  period,
  kind,
  onChange,
}: {
  value: string;
  currency: string;
  period: string;
  kind: "minimum" | "target";
  onChange: (value: string) => void;
}) {
  const range = salaryRange(value, period);
  const [expandedMax, setExpandedMax] = useState(range.max);
  const maximum = Math.max(expandedMax, range.max);
  function change(amount: string) {
    setExpandedMax((previous) =>
      Math.max(previous, salaryRange(amount, period).max),
    );
    onChange(amount);
  }
  const label = kind === "minimum" ? "Private minimum" : "Target amount";
  return (
    <div className="onb-salary">
      <Field
        label={`${label} — exact amount`}
        hint={`Enter ${currency} per ${period}. Your exact entry is kept without rounding.`}
      >
        <span className="onb-amount-input">
          <span aria-hidden="true">{currency}</span>
          <input
            aria-label={`${label} — exact amount`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Not set"
            value={value}
            onChange={(e) => change(e.target.value)}
          />
          <span aria-hidden="true">/ {period}</span>
        </span>
      </Field>
      <label className="onb-range-label" htmlFor="salary-range">
        Adjust {label.toLowerCase()}
      </label>
      <input
        id="salary-range"
        className="onb-salary-range"
        type="range"
        min="0"
        max={maximum}
        step={range.step}
        value={range.value}
        disabled={!range.supported}
        aria-valuetext={
          value
            ? `${value} ${currency} per ${period}`
            : `Not set. Move the slider to choose ${currency} per ${period}.`
        }
        onChange={(e) => change(e.target.value)}
      />
      <div className="onb-range-scale" aria-hidden="true">
        <span>0 {currency}</span>
        <span>
          {maximum.toLocaleString("en-US")} {currency}
        </span>
      </div>
      <p className="onb-hint">
        {range.supported
          ? `Use the slider for a starting point, or type your exact amount. Larger amounts expand the range. Arrow keys adjust by ${range.step}.`
          : "Your exact entry is preserved. The slider is unavailable for this value; use the amount field to edit it."}
      </p>
      {value && (
        <Button type="button" className="onb-text" onClick={() => onChange("")}>
          Clear {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
