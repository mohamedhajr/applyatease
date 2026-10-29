import { Schema } from "effect";
import { AnalysisInput } from "./career.ts";
const Text = Schema.String.check(Schema.isMaxLength(12000));
const Items = Schema.Array(Text).check(Schema.isMaxLength(80));
export const FactResolution = Schema.Struct({
  factId: Text,
  label: Text,
  sourceValue: Text,
  resolvedValue: Text,
  status: Schema.Literals(["candidate_confirmed", "candidate_denied"]),
  sourceHash: Text,
  evidenceIds: Items,
  confirmedAt: Text,
});
export type FactResolution = typeof FactResolution.Type;
export const WorkflowSource = Schema.Struct({
  ...AnalysisInput.fields,
  sourceHash: Schema.String.check(Schema.isPattern(/^(?:|[a-f0-9]{64})$/u)),
});
export const WorkflowProfile = Schema.Struct({
  id: Text,
  version: Text,
  researchOnly: Schema.Boolean,
  targets: Items,
  preferences: Items,
  confirmedFacts: Items,
  factResolutions: Schema.optionalKey(
    Schema.Array(FactResolution).check(Schema.isMaxLength(300)),
  ),
  source: WorkflowSource,
});
export type WorkflowProfile = typeof WorkflowProfile.Type;
export const SourceCapture = Schema.Struct({
  id: Text,
  originalUrl: Text,
  finalUrl: Text,
  canonicalUrl: Text,
  retrievedAt: Text,
  hash: Text,
  text: Schema.String.check(Schema.isMaxLength(180000)),
  status: Schema.Literals([
    "inspected",
    "inaccessible",
    "closed",
    "unverified",
  ]),
  httpStatus: Schema.Finite,
  limitations: Items,
});
export type SourceCapture = typeof SourceCapture.Type;
export const Citation = Schema.Struct({
  source: Schema.Literals(["job", "cv", "form"]),
  section: Text,
  quote: Text,
});
export const SearchPlan = Schema.Struct({
  queries: Schema.Array(Text).check(Schema.isMaxLength(5)),
  missingInputs: Items,
  rationale: Text,
});
export type SearchPlan = typeof SearchPlan.Type;
export const Assessment = Schema.Struct({
  title: Text,
  employer: Text,
  requisitionId: Text,
  applicationUrl: Text,
  freshness: Schema.Literals(["current", "closed", "uncertain"]),
  verdict: Schema.Literals([
    "strong_match",
    "plausible_stretch",
    "needs_clarification",
    "outside_constraints",
  ]),
  dimensions: Schema.Array(
    Schema.Struct({
      dimension: Schema.Literals([
        "geography",
        "authorization",
        "work_mode",
        "employment",
        "language",
        "pay",
        "travel",
        "overlap",
      ]),
      result: Schema.Literals(["compatible", "incompatible", "unknown"]),
      reason: Text,
      evidence: Schema.Array(Citation),
    }),
  ),
  requirements: Schema.Array(
    Schema.Struct({
      requirement: Text,
      support: Schema.Literals([
        "direct",
        "adjacent",
        "not_evidenced",
        "conflicting",
      ]),
      reason: Text,
      evidence: Schema.Array(Citation),
    }),
  ),
  questions: Items,
  nextAction: Text,
});
export type Assessment = typeof Assessment.Type;
export const Requirements = Schema.Struct({
  completion: Schema.Literal("partial"),
  mode: Schema.Literal("static_html"),
  fields: Schema.Array(
    Schema.Struct({
      id: Text,
      label: Text,
      type: Text,
      required: Schema.Literals(["required", "optional", "unknown"]),
      choices: Items,
      constraints: Text,
      responseKind: Schema.Literals([
        "profile_fact",
        "draftable_answer",
        "critical_confirmation",
        "manual_task",
      ]),
      scope: Text,
      evidence: Schema.Array(Citation),
    }),
  ),
  attachments: Items,
  limitations: Items,
  nextActions: Items,
});
export type Requirements = typeof Requirements.Type;
export const Preparation = Schema.Struct({
  status: Schema.Literal("awaiting_review"),
  applicationComplete: Schema.Literal(false),
  documentMode: Schema.Literal("exact_edit_plan"),
  sectionReview: Schema.Array(
    Schema.Struct({
      section: Text,
      decision: Schema.Literals(["retain", "edit", "flag"]),
      reason: Text,
    }),
  ),
  edits: Schema.Array(
    Schema.Struct({
      section: Text,
      before: Text,
      after: Text,
      reason: Text,
      evidence: Schema.Array(Citation),
    }),
  ),
  answers: Schema.Array(
    Schema.Struct({
      fieldId: Text,
      label: Text,
      text: Text,
      status: Schema.Literals(["draft", "needs_confirmation", "manual_task"]),
      evidence: Schema.Array(Citation),
    }),
  ),
  coverLetter: Text,
  confirmations: Items,
  limitations: Items,
  qualityChecks: Items,
});
export type Preparation = typeof Preparation.Type;
export const RunMetadata = Schema.Struct({
  id: Text,
  createdAt: Text,
  model: Text,
  operation: Text,
  elapsedMs: Schema.Finite,
  validationAttempts: Schema.Finite,
  tokensUsed: Schema.NullOr(Schema.Finite),
  searchObserved: Schema.Boolean,
  searchEvidence: Schema.Array(Schema.Struct({ query: Text, urls: Items })),
  skillVersion: Text,
  skillHash: Text,
  profileVersion: Text,
  sourceHashes: Items,
});
export type RunMetadata = typeof RunMetadata.Type;
export type WorkflowResult<T> = { result: T; run: RunMetadata };
export const PlanInput = Schema.Struct({ profile: WorkflowProfile });
export const DiscoverInput = Schema.Struct({
  profile: WorkflowProfile,
  plan: SearchPlan,
});
export const InspectInput = Schema.Struct({
  url: Text,
  researchOnly: Schema.Boolean,
});
export const AssessInput = Schema.Struct({
  profile: WorkflowProfile,
  job: SourceCapture,
});
export const RequirementsInput = Schema.Struct({
  url: Text,
  researchOnly: Schema.Boolean,
});
export const PrepareInput = Schema.Struct({
  profile: WorkflowProfile,
  job: SourceCapture,
  form: SourceCapture,
  requirements: Requirements,
});
export const DiscoveryLeads = Schema.Struct({
  leads: Schema.Array(Schema.Struct({ url: Text, title: Text })).check(
    Schema.isMaxLength(10),
  ),
  limitations: Items,
});
export const DiscoverResult = Schema.Struct({
  ...DiscoveryLeads.fields,
  sources: Schema.Array(SourceCapture),
});
export type DiscoverResult = typeof DiscoverResult.Type;
