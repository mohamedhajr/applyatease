import {
  countryStep,
  effectiveAnalysis,
  effectiveFact,
  experienceStep,
  levelStep,
  payStep,
  payUnits,
  relevantCountries,
  validAmount,
  validSampleUrl,
  type Profile,
  type Step,
} from "../onboarding/model.ts";

export type DetailState = "provided" | "provisional" | "skipped" | "unknown";
export interface CompletionItem {
  id: string;
  label: string;
  purpose: "Needed for search" | "Useful later";
  reason: string;
  state: DetailState;
  step: Step;
}
export const detailStateLabel: Record<DetailState, string> = {
  provided: "Provided",
  provisional: "Needs confirmation",
  skipped: "Left for later",
  unknown: "Not provided",
};
export function profileCompletion(profile: Profile): CompletionItem[] {
  const items: CompletionItem[] = [];
  const analysis = effectiveAnalysis(profile);
  const add = (
    id: string,
    label: string,
    step: Step,
    provided: boolean,
    needed: boolean,
    reason: string,
    provisional = false,
  ) => {
    items.push({
      id,
      label,
      step,
      purpose: needed ? "Needed for search" : "Useful later",
      reason,
      state: provided
        ? "provided"
        : profile.skipped.includes(step)
          ? "skipped"
          : provisional
            ? "provisional"
            : "unknown",
    });
  };
  add(
    "roles",
    "Target roles",
    "roles",
    profile.roles.length > 0,
    true,
    "The directions you want to explore.",
  );
  add(
    "modes",
    "Work modes",
    "work-modes",
    profile.workModes.length > 0,
    true,
    "Where and how you would like to work.",
  );
  add(
    "employment",
    "Employment types",
    "work",
    profile.employment.length > 0,
    true,
    "Your preferred employment and contract arrangements.",
  );
  if (profile.workModes.includes("remote")) {
    add(
      "remote-location",
      "Remote work country",
      "location",
      Boolean(profile.country.trim()),
      true,
      "Where you will physically work, not an employer’s headquarters.",
    );
    add(
      "overlap",
      "Remote team overlap",
      "overlap",
      Boolean(profile.overlap.trim()),
      false,
      "Preferred working hours can be discussed for each role.",
    );
  }
  if (profile.workModes.some((mode) => mode === "hybrid" || mode === "on-site"))
    add(
      "in-person",
      "In-person locations",
      "in-person",
      profile.inPersonCountries.length > 0,
      true,
      "The physical destinations relevant to hybrid or on-site work.",
    );
  const residenceProposal = analysis?.facts.find(
    (fact) =>
      fact.kind === "residence" &&
      effectiveFact(profile, fact).status !== "candidate_denied",
  );
  add(
    "residence",
    "Current location",
    "residence",
    Boolean(profile.residence.trim()),
    false,
    "Current residence stays separate from work authorization.",
    Boolean(residenceProposal),
  );
  for (const role of profile.roles) {
    add(
      `experience:${role.title}`,
      `${role.title} · experience`,
      experienceStep(role.title),
      Boolean(
        role.experienceLevel &&
        role.experienceLevel !== "Not sure yet" &&
        role.experienceConfirmedAt,
      ),
      false,
      "Your self-reported experience in this direction.",
      Boolean(
        role.experienceLevel ||
        analysis?.roles.some(
          (suggestion) =>
            suggestion.title.toLowerCase() === role.title.toLowerCase() &&
            suggestion.experienceLevel,
        ),
      ),
    );
    add(
      `level:${role.title}`,
      `${role.title} · desired level`,
      levelStep(role.title),
      Boolean(role.level),
      false,
      "The level you want to target, which can differ from your experience.",
    );
  }
  for (const country of relevantCountries(profile)) {
    const answer = profile.countryAnswers[country];
    add(
      `country:${country}`,
      `Authorization · ${country}`,
      countryStep(country),
      Boolean(answer?.authorization && answer.authorization !== "unsure"),
      false,
      "A country-scoped answer; each employer’s exact declaration still needs review.",
      answer?.authorization === "unsure",
    );
  }
  add(
    "cv",
    "Original CV",
    "cv",
    Boolean(profile.cv),
    false,
    "Source material for your career profile and later tailoring.",
  );
  add(
    "availability",
    "Availability",
    "preferences",
    Boolean(profile.availability.trim()),
    false,
    "A reusable starting point when a role has a start-date requirement.",
  );
  if (profile.payEnabled)
    for (const basis of profile.employment) {
      const pay = profile.payByEmployment[basis];
      const units = Boolean(
        pay?.currency && pay.period && pay.confirmedUnits === payUnits(pay),
      );
      const complete = Boolean(pay && units && validAmount(pay.minimum));
      add(
        `pay:${basis}`,
        `${employmentLabels[basis]} · private minimum`,
        payStep(
          basis,
          !pay?.currency ? "currency" : !pay.period ? "period" : "minimum",
        ),
        complete,
        false,
        "Exact private preferences, never an automatic employer-facing salary answer.",
        Boolean(pay?.minimum && !complete),
      );
    }
  if (profile.sampleChoice === "add")
    add(
      "sample",
      "Work-sample contribution",
      validSampleUrl(profile.sampleUrl) ? "contribution" : "sample-url",
      validSampleUrl(profile.sampleUrl) && Boolean(profile.contribution.trim()),
      false,
      "A link needs your own contribution stated separately from ownership.",
    );
  return items;
}
export const employmentLabels: Record<Profile["employment"][number], string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Long-term contract",
  "short-contract": "Short-term contract",
  internship: "Internship",
};
export const workModeLabels: Record<Profile["workModes"][number], string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  "on-site": "On-site",
};
