import { Schema } from "effect";
import {
  Assessment,
  Preparation,
  Requirements,
  RunMetadata,
  SearchPlan,
  SourceCapture,
  WorkflowProfile,
} from "@applyatease/contracts/workflow";
import {
  countryStep,
  experienceStep,
  levelStep,
  payStep,
  payUnits,
  relevantCountries,
  type Profile,
} from "../onboarding/model.ts";

const SavedAssessment = Schema.Struct({
  result: Assessment,
  run: RunMetadata,
  sourceUrl: Schema.optional(Schema.String),
});
const SavedRequirements = Schema.Struct({
  result: Requirements,
  run: RunMetadata,
  source: SourceCapture,
  version: Schema.optional(Schema.String),
});
const SavedPreparation = Schema.Struct({
  result: Preparation,
  run: RunMetadata,
  requirementsVersion: Schema.optional(Schema.String),
  cvSourceHash: Schema.optional(Schema.String),
  sourceUrl: Schema.optional(Schema.String),
});
export const Opportunity = Schema.Struct({
  id: Schema.String,
  addedAt: Schema.String,
  updatedAt: Schema.String,
  disposition: Schema.Literals(["new", "saved", "dismissed"]),
  source: SourceCapture,
  sourceHistory: Schema.Array(SourceCapture),
  assessment: Schema.NullOr(SavedAssessment),
  requirements: Schema.NullOr(SavedRequirements),
  preparation: Schema.NullOr(SavedPreparation),
  preparationHistory: Schema.optional(Schema.Array(SavedPreparation)),
  requirementsHistory: Schema.optional(Schema.Array(SavedRequirements)),
  notes: Schema.String,
  answerDrafts: Schema.Record(Schema.String, Schema.String),
  draftHistory: Schema.optional(
    Schema.Array(
      Schema.Struct({
        opportunityId: Schema.String,
        savedAt: Schema.String,
        requirements: Schema.NullOr(SavedRequirements),
        preparation: Schema.optional(Schema.NullOr(SavedPreparation)),
        drafts: Schema.Record(Schema.String, Schema.String),
      }),
    ),
  ),
});
export type Opportunity = typeof Opportunity.Type;
export const WorkflowEvent = Schema.Struct({
  id: Schema.String,
  at: Schema.String,
  opportunityId: Schema.String,
  action: Schema.String,
  status: Schema.Literals([
    "running",
    "completed",
    "failed",
    "cancelled",
    "interrupted",
  ]),
  message: Schema.String,
});
export type WorkflowEvent = typeof WorkflowEvent.Type;
export const Workspace = Schema.Struct({
  version: Schema.Literal(1),
  revision: Schema.Number,
  selectedId: Schema.String,
  plan: Schema.NullOr(Schema.Struct({ result: SearchPlan, run: RunMetadata })),
  opportunities: Schema.Array(Opportunity),
  events: Schema.Array(WorkflowEvent),
});
export type Workspace = typeof Workspace.Type;
export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    revision: 0,
    selectedId: "",
    plan: null,
    opportunities: [],
    events: [],
  };
}
export function normalizedUrl(url: string): string {
  try {
    const value = new URL(url);
    value.hash = "";
    for (const key of [...value.searchParams.keys()])
      if (/^(utm_|gclid$|fbclid$|gh_src$)/i.test(key))
        value.searchParams.delete(key);
    value.searchParams.sort();
    return value.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname || "Unverified source";
  } catch {
    return "Invalid source URL";
  }
}
export function mergeSource(
  workspace: Workspace,
  source: SourceCapture,
  now = new Date().toISOString(),
  refreshId?: string,
): Workspace {
  const existing = workspace.opportunities.find((job) =>
    refreshId
      ? job.id === refreshId
      : normalizedUrl(job.source.canonicalUrl) ===
          normalizedUrl(source.canonicalUrl) ||
        normalizedUrl(job.source.finalUrl) === normalizedUrl(source.finalUrl),
  );
  if (existing) {
    return {
      ...workspace,
      selectedId: existing.id,
      opportunities: workspace.opportunities.map((job) =>
        job.id !== existing.id
          ? job
          : {
              ...job,
              source,
              updatedAt: now,
              sourceHistory:
                job.source.hash === source.hash &&
                job.source.canonicalUrl === source.canonicalUrl
                  ? job.sourceHistory
                  : [...job.sourceHistory, job.source],
            },
      ),
    };
  }
  const id = crypto.randomUUID();
  return {
    ...workspace,
    selectedId: id,
    opportunities: [
      ...workspace.opportunities,
      {
        id,
        addedAt: now,
        updatedAt: now,
        disposition: "new",
        source,
        sourceHistory: [],
        assessment: null,
        requirements: null,
        preparation: null,
        notes: "",
        answerDrafts: {},
      },
    ],
  };
}
export function deduplicateAssessed(
  workspace: Workspace,
  assessedId: string,
): Workspace {
  const current = workspace.opportunities.find((job) => job.id === assessedId);
  const identity = current?.assessment?.result;
  if (!current || !identity?.requisitionId.trim() || !identity.employer.trim())
    return workspace;
  const employer = identity.employer.trim().toLocaleLowerCase();
  const requisition = identity.requisitionId.trim().toLocaleLowerCase();
  const matching = workspace.opportunities.filter(
    (job) =>
      !!job.assessment &&
      assessmentCurrent(job, job.assessment.run.profileVersion) &&
      job.assessment?.result.requisitionId.trim().toLocaleLowerCase() ===
        requisition &&
      job.assessment.result.employer.trim().toLocaleLowerCase() === employer,
  );
  if (matching.length < 2) return workspace;
  const stable = matching.reduce((left, right) =>
    left.addedAt <= right.addedAt ? left : right,
  );
  const duplicates = matching.filter((job) => job.id !== stable.id);
  const allSources = [
    ...stable.sourceHistory,
    ...duplicates.flatMap((job) => [job.source, ...job.sourceHistory]),
  ];
  const sourceHistory = allSources.filter(
    (source, index) =>
      !(
        source.hash === stable.source.hash &&
        source.canonicalUrl === stable.source.canonicalUrl
      ) &&
      allSources.findIndex(
        (item) =>
          item.hash === source.hash &&
          item.canonicalUrl === source.canonicalUrl,
      ) === index,
  );
  const duplicateIds = new Set(duplicates.map((job) => job.id));
  const retained: Opportunity = {
    ...stable,
    sourceHistory,
    disposition:
      stable.disposition !== "new"
        ? stable.disposition
        : (duplicates.find((job) => job.disposition !== "new")?.disposition ??
          "new"),
    assessment: stable.assessment ?? current.assessment,
    requirementsHistory: [
      ...(stable.requirementsHistory ?? []),
      ...duplicates.flatMap((job) => [
        ...(job.requirementsHistory ?? []),
        ...(job.requirements ? [job.requirements] : []),
      ]),
    ],
    preparationHistory: [
      ...(stable.preparationHistory ?? []),
      ...duplicates.flatMap((job) => [
        ...(job.preparationHistory ?? []),
        ...(job.preparation ? [job.preparation] : []),
      ]),
    ],
    draftHistory: [
      ...(stable.draftHistory ?? []),
      ...duplicates.flatMap((job) => [
        ...(job.draftHistory ?? []),
        ...(Object.keys(job.answerDrafts).length
          ? [
              {
                opportunityId: job.id,
                savedAt: job.updatedAt,
                requirements: job.requirements,
                drafts: job.answerDrafts,
              },
            ]
          : []),
      ]),
    ],
    notes: [stable.notes, ...duplicates.map((job) => job.notes)]
      .filter(Boolean)
      .join("\n\n"),
  };
  return {
    ...workspace,
    selectedId: duplicateIds.has(workspace.selectedId)
      ? stable.id
      : workspace.selectedId,
    opportunities: workspace.opportunities
      .filter((job) => !duplicateIds.has(job.id))
      .map((job) => (job.id === stable.id ? retained : job)),
    events: workspace.events.map((event) =>
      duplicateIds.has(event.opportunityId)
        ? { ...event, opportunityId: stable.id }
        : event,
    ),
  };
}
export function archiveAnswerDrafts(
  job: Pick<
    Opportunity,
    | "id"
    | "updatedAt"
    | "answerDrafts"
    | "draftHistory"
    | "requirements"
    | "preparation"
  >,
) {
  return {
    answerDrafts: {},
    draftHistory: [
      ...(job.draftHistory ?? []),
      ...(Object.keys(job.answerDrafts).length
        ? [
            {
              opportunityId: job.id,
              savedAt: job.updatedAt,
              requirements: job.requirements,
              preparation: job.preparation,
              drafts: job.answerDrafts,
            },
          ]
        : []),
    ],
  };
}
export function assessmentCurrent(job: Opportunity, version: string) {
  return (
    !!job.assessment &&
    job.assessment.sourceUrl === job.source.canonicalUrl &&
    job.assessment.run.profileVersion === version &&
    job.assessment.run.sourceHashes.includes(job.source.hash)
  );
}
export function preparationCurrent(job: Opportunity, version: string) {
  return (
    !!job.preparation &&
    job.preparation.sourceUrl === job.source.canonicalUrl &&
    !!job.requirements &&
    job.preparation.run.profileVersion === version &&
    job.preparation.run.sourceHashes.includes(job.source.hash) &&
    job.preparation.run.sourceHashes.includes(job.requirements.source.hash) &&
    !!job.requirements.version &&
    job.preparation.requirementsVersion === job.requirements.version
  );
}
export function needsReview(job: Opportunity) {
  return (
    job.disposition !== "dismissed" &&
    !!(
      job.preparation ||
      job.requirements ||
      job.assessment?.result.questions.length ||
      job.assessment?.result.verdict === "needs_clarification"
    )
  );
}
export async function workflowProfile(
  profile: Profile,
  id: string,
  researchOnly: boolean,
): Promise<WorkflowProfile> {
  const accepted = (step: string) =>
    researchOnly || !!profile.confirmations[step];
  const preferences = [
    accepted("residence") &&
      profile.residence &&
      `Residence: ${profile.residence}`,
    accepted("location") &&
      profile.workModes.includes("remote") &&
      profile.country &&
      `Target hiring location: ${profile.country}`,
    accepted("overlap") &&
      profile.workModes.includes("remote") &&
      profile.overlap &&
      `Working overlap preference: ${profile.overlap}`,
    accepted("travel") &&
      profile.travel &&
      `Travel preference: ${profile.travel}`,
    accepted("exclusions") &&
      profile.exclusions &&
      `Exclusions: ${profile.exclusions}`,
    accepted("preferences") &&
      profile.availability &&
      `Availability: ${profile.availability}`,
    accepted("work") &&
      profile.employment.length &&
      `Employment preferences: ${profile.employment.join(", ")}`,
    accepted("work-modes") &&
      profile.workModes.length &&
      `Work mode preferences: ${profile.workModes.join(", ")}`,
    ...profile.employment.flatMap((basis) => {
      const pay = profile.payByEmployment[basis];
      if (
        !profile.payEnabled ||
        !pay ||
        (!researchOnly &&
          (pay.confirmedUnits !== payUnits(pay) ||
            !profile.confirmations[payStep(basis, "minimum")]))
      )
        return [];
      return [
        `Private ${basis} compensation floor: ${pay.minimum || "unknown"} ${pay.currency} per ${pay.period}${pay.target && (researchOnly || profile.confirmations[payStep(basis, "target")]) ? `; target ${pay.target}` : ""}. Not an employer application salary answer.`,
      ];
    }),
  ].filter((value): value is string => typeof value === "string" && !!value);
  const confirmedFacts = researchOnly
    ? []
    : relevantCountries(profile).flatMap((country) => {
        const answer = profile.countryAnswers[country];
        if (!answer || !profile.confirmations[countryStep(country)]) return [];
        return [
          JSON.stringify({
            country,
            authorization: answer.authorization,
            sponsorshipNow: profile.confirmations[
              `sponsor:${encodeURIComponent(country)}`
            ]
              ? answer.sponsorshipNow
              : "unknown",
            sponsorshipLater: profile.confirmations[
              `future:${encodeURIComponent(country)}`
            ]
              ? answer.sponsorshipLater
              : "unknown",
            confirmedAt: profile.confirmations[countryStep(country)],
          }),
        ];
      });
  const analysis =
    profile.analysis.result?.sourceHash === profile.cv?.hash
      ? profile.analysis.result
      : null;
  const factResolutions = researchOnly
    ? []
    : (analysis?.facts ?? []).flatMap((fact) => {
        const correction = profile.corrections.findLast(
          (item) =>
            item.sourceHash === profile.cv?.hash && item.factId === fact.id,
        );
        return correction
          ? [
              {
                factId: fact.id,
                label: fact.label,
                sourceValue: fact.value,
                resolvedValue: correction.value,
                status: correction.status,
                sourceHash: correction.sourceHash,
                evidenceIds: fact.evidenceIds,
                confirmedAt: correction.confirmedAt,
              },
            ]
          : [];
      });
  const value = {
    id,
    researchOnly,
    targets: profile.roles
      .filter(() => researchOnly || !!profile.confirmations.roles)
      .map(
        (role) =>
          `${role.title}${role.level && accepted(levelStep(role.title)) ? `; target level: ${role.level}` : ""}${role.experienceConfirmedAt && profile.confirmations[experienceStep(role.title)] && !researchOnly ? `; candidate-confirmed experience level: ${role.experienceLevel}` : ""}${researchOnly ? "; researcher-selected target, not a candidate preference or qualification" : profile.confirmations.roles ? "; confirmed search target, not a qualification" : "; unconfirmed search target"}`,
      ),
    preferences: researchOnly
      ? preferences.map(
          (item) => `Researcher-selected, not candidate-confirmed: ${item}`,
        )
      : preferences,
    confirmedFacts,
    factResolutions,
    source: {
      sourceHash: profile.cv?.hash ?? "",
      sections: profile.cv?.sections ?? [],
      warnings: profile.cv?.warnings ?? [],
    },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const version = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  return Schema.decodeUnknownSync(WorkflowProfile)({ ...value, version });
}
