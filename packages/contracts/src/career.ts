import { Schema } from "effect";

const Text = Schema.String.check(Schema.isMaxLength(8000));
const Ids = Schema.Array(Schema.String).check(Schema.isMaxLength(40));
export const Evidence = Schema.Struct({ id: Text, section: Text, quote: Text });
export type Evidence = typeof Evidence.Type;
export const FactProposal = Schema.Struct({
  id: Text,
  kind: Schema.Literals([
    "residence",
    "contact",
    "experience",
    "skill",
    "project",
    "education",
    "credential",
    "link",
  ]),
  label: Text,
  value: Text,
  evidenceIds: Ids,
  uncertainty: Text,
});
export type FactProposal = typeof FactProposal.Type;
export const RoleSuggestion = Schema.Struct({
  title: Text,
  support: Schema.Literals(["direct", "transferable"]),
  experienceLevel: Text,
  reasons: Schema.Array(Text),
  evidenceIds: Ids,
  uncertainty: Text,
});
export type RoleSuggestion = typeof RoleSuggestion.Type;
export const AnalysisContent = Schema.Struct({
  coverage: Schema.Array(Text),
  limitations: Schema.Array(Text),
  evidence: Schema.Array(Evidence).check(Schema.isMaxLength(300)),
  snapshot: Schema.Array(Schema.Struct({ text: Text, evidenceIds: Ids })),
  facts: Schema.Array(FactProposal).check(Schema.isMaxLength(300)),
  roles: Schema.Array(RoleSuggestion).check(Schema.isMaxLength(3)),
  findings: Schema.Array(
    Schema.Struct({
      dimension: Text,
      observation: Text,
      action: Text,
      evidenceIds: Ids,
    }),
  ),
});
export const CvAnalysis = Schema.Struct({
  ...AnalysisContent.fields,
  id: Schema.String,
  sourceHash: Schema.String,
  createdAt: Schema.String,
  model: Schema.String,
  instructionVersion: Schema.String,
});
export type CvAnalysis = typeof CvAnalysis.Type;
export const AnalysisInput = Schema.Struct({
  sourceHash: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  sections: Schema.Array(
    Schema.Struct({
      label: Text,
      text: Schema.String.check(Schema.isMaxLength(250000)),
    }),
  ).check(Schema.isMaxLength(40)),
  warnings: Schema.Array(Text),
});
export type AnalysisInput = typeof AnalysisInput.Type;
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
export function validateAnalysis(
  content: typeof AnalysisContent.Type,
  source: AnalysisInput,
) {
  const ids = new Set<string>();
  for (const evidence of content.evidence) {
    const section = source.sections.find((s) => s.label === evidence.section);
    if (
      !evidence.id.trim() ||
      !content.coverage.includes(evidence.section) ||
      !section ||
      !normalize(evidence.quote) ||
      !normalize(section.text).includes(normalize(evidence.quote)) ||
      ids.has(evidence.id)
    )
      throw new Error(
        "Analysis contains an invalid source reference. Retry analysis or continue manually.",
      );
    ids.add(evidence.id);
  }
  for (const item of [
    ...content.snapshot,
    ...content.facts,
    ...content.roles,
    ...content.findings,
  ]) {
    if (!item.evidenceIds.length || item.evidenceIds.some((id) => !ids.has(id)))
      throw new Error(
        "Analysis contains unsupported claims. Retry analysis or continue manually.",
      );
  }
  if (
    new Set(content.facts.map((f) => f.id)).size !== content.facts.length ||
    content.facts.some((f) => !f.id.trim())
  )
    throw new Error("Analysis contains duplicate or empty fact identifiers.");
  if (new Set(content.coverage).size !== content.coverage.length)
    throw new Error("Analysis repeats a source section.");
  if (
    content.coverage.some(
      (label) => !source.sections.some((s) => s.label === label),
    )
  )
    throw new Error("Analysis reports source sections that were not supplied.");
  return content;
}
