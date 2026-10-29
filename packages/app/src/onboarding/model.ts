import { Schema } from "effect";
import { CvAnalysis } from "./analysis.ts";

export const Employment = Schema.Literals([
  "full-time",
  "part-time",
  "contract",
  "short-contract",
  "internship",
]);
export type Employment = typeof Employment.Type;
const BasicStep = Schema.Literals([
  "goal",
  "cv",
  "cv-review",
  "cv-notes",
  "cv-story",
  "roles",
  "direction",
  "location",
  "residence",
  "timezone",
  "overlap",
  "work",
  "work-modes",
  "in-person",
  "cv-analysis",
  "eligibility",
  "sponsorship-now",
  "sponsorship-later",
  "preferences",
  "travel",
  "exclusions",
  "compensation",
  "evidence",
  "sample-url",
  "contribution",
  "review",
]);
export const PayQuestion = Schema.Literals([
  "currency",
  "period",
  "minimum",
  "target",
]);
export type PayQuestion = typeof PayQuestion.Type;
export const Step = Schema.Union([
  BasicStep,
  Schema.TemplateLiteral(["level:", Schema.String]),
  Schema.TemplateLiteral(["experience:", Schema.String]),
  Schema.TemplateLiteral(["country:", Schema.String]),
  Schema.TemplateLiteral(["sponsor:", Schema.String]),
  Schema.TemplateLiteral(["future:", Schema.String]),
  Schema.TemplateLiteral(["pay:", Employment, ":", PayQuestion]),
]);
export type Step = typeof Step.Type;
export const levelStep = (title: string): Step =>
  `level:${encodeURIComponent(title)}`;
export const payStep = (basis: Employment, question: PayQuestion): Step =>
  `pay:${basis}:${question}`;
export function roleForStep(step: Step, p: Profile) {
  return p.roles.find((role) => levelStep(role.title) === step);
}
export const employmentOptions = [
  ["full-time", "Full-time employment"],
  ["part-time", "Part-time employment"],
  ["contract", "Long-term contract"],
  ["short-contract", "Short-term contract"],
  ["internship", "Internship"],
] as const;
export function payForStep(step: Step) {
  for (const [basis] of employmentOptions)
    for (const question of ["currency", "period", "minimum", "target"] as const)
      if (step === payStep(basis, question))
        return {
          basis,
          question,
          key:
            basis === "full-time"
              ? ("fullTimePay" as const)
              : ("contractPay" as const),
        };
  return null;
}
const Role = Schema.Struct({
  title: Schema.String,
  level: Schema.String,
  experienceLevel: Schema.String,
  experienceConfirmedAt: Schema.String,
});
const Pay = Schema.Struct({
  minimum: Schema.String,
  target: Schema.String,
  currency: Schema.String,
  period: Schema.Literals(["", "year", "month", "hour"]),
});
export const CvSource = Schema.Struct({
  name: Schema.String,
  size: Schema.Finite,
  hash: Schema.String,
  importedAt: Schema.String,
  format: Schema.Literals(["pdf", "docx"]),
  sections: Schema.Array(
    Schema.Struct({ label: Schema.String, text: Schema.String }),
  ),
  warnings: Schema.Array(Schema.String),
  reviewedAt: Schema.String,
  notes: Schema.String,
});
export type CvSource = typeof CvSource.Type;
const LegacyProfile = Schema.Struct({
  version: Schema.Literal(1),
  updatedAt: Schema.String,
  confirmedAt: Schema.String,
  step: Step,
  visited: Schema.Array(Step),
  goal: Schema.Literals(["", "find", "explore", "change"]),
  cv: Schema.NullOr(CvSource),
  roles: Schema.Array(
    Schema.Struct({ title: Schema.String, level: Schema.String }),
  ),
  country: Schema.String,
  residence: Schema.String,
  // Retained for compatibility with existing local profiles.
  timezone: Schema.String,
  overlap: Schema.String,
  employment: Schema.Array(Employment),
  authorization: Schema.Literals(["", "yes", "no", "unsure"]),
  sponsorshipNow: Schema.Literals(["", "yes", "no", "unsure"]),
  sponsorshipLater: Schema.Literals(["", "yes", "no", "unsure"]),
  availability: Schema.String,
  travel: Schema.String,
  exclusions: Schema.String,
  payEnabled: Schema.Boolean,
  fullTimePay: Pay,
  contractPay: Pay,
  sampleChoice: Schema.Literals(["", "add", "later"]),
  sampleUrl: Schema.String,
  contribution: Schema.String,
});
const Confirmation = Schema.Literals(["", "yes", "no", "unsure"]);
export const CountryAnswer = Schema.Struct({
  authorization: Schema.Literals(["", "unrestricted", "yes", "no", "unsure"]),
  sponsorshipNow: Confirmation,
  sponsorshipLater: Confirmation,
  confirmedAt: Schema.String,
});
export const AnalysisState = Schema.Struct({
  status: Schema.Literals([
    "idle",
    "running",
    "ready",
    "partial",
    "failed",
    "unavailable",
  ]),
  sourceHash: Schema.String,
  message: Schema.String,
  result: Schema.NullOr(CvAnalysis),
});
export const Profile = Schema.Struct({
  ...LegacyProfile.fields,
  version: Schema.Literal(2),
  setupCompletedAt: Schema.String,
  roles: Schema.Array(Role),
  roleDrafts: Schema.optional(Schema.Record(Schema.String, Role)),
  workModes: Schema.Array(Schema.Literals(["remote", "hybrid", "on-site"])),
  inPersonCountries: Schema.Array(Schema.String),
  confirmations: Schema.Record(Schema.String, Schema.String),
  skipped: Schema.Array(Schema.String),
  countryAnswers: Schema.Record(Schema.String, CountryAnswer),
  payByEmployment: Schema.Record(
    Schema.String,
    Schema.Struct({ ...Pay.fields, confirmedUnits: Schema.String }),
  ),
  analysis: AnalysisState,
  analysisHistory: Schema.Array(CvAnalysis),
  corrections: Schema.Array(
    Schema.Struct({
      factId: Schema.String,
      sourceHash: Schema.String,
      value: Schema.String,
      status: Schema.Literals(["candidate_confirmed", "candidate_denied"]),
      confirmedAt: Schema.String,
    }),
  ),
});
export type Profile = typeof Profile.Type;
export const blankPay = () => ({
  minimum: "",
  target: "",
  currency: "",
  period: "" as const,
});
export function emptyProfile(): Profile {
  return {
    version: 2,
    roleDrafts: {},
    setupCompletedAt: "",
    workModes: [],
    inPersonCountries: [],
    confirmations: {},
    skipped: [],
    countryAnswers: {},
    payByEmployment: {},
    analysis: { status: "idle", sourceHash: "", message: "", result: null },
    analysisHistory: [],
    corrections: [],
    updatedAt: "",
    confirmedAt: "",
    step: "goal",
    visited: [],
    goal: "",
    cv: null,
    roles: [],
    country: "",
    residence: "",
    timezone: "",
    overlap: "",
    employment: [],
    authorization: "",
    sponsorshipNow: "",
    sponsorshipLater: "",
    availability: "",
    travel: "",
    exclusions: "",
    payEnabled: false,
    fullTimePay: blankPay(),
    contractPay: blankPay(),
    sampleChoice: "",
    sampleUrl: "",
    contribution: "",
  };
}
export const suggestedRoles = [
  "Forward Deployed Engineer",
  "AWS Cloud Engineer",
  "DevOps Engineer",
  "Digital Marketing",
  "Video Editor",
];
export function creativeProfile(profile: Profile) {
  return profile.roles.some(({ title }) =>
    /video|edit|market|design|creativ|content|film/i.test(title),
  );
}
export function relevantCountries(p: Profile): string[] {
  if (
    !p.employment.some((e) =>
      ["full-time", "part-time", "internship"].includes(e),
    )
  )
    return [];
  return [
    ...new Set([
      ...(p.workModes.includes("remote") && p.country.trim()
        ? [p.country]
        : []),
      ...(p.workModes.some((m) => m !== "remote") ? p.inPersonCountries : []),
    ]),
  ];
}
export function stepsFor(p: Profile): Step[] {
  return [
    "goal",
    "cv",
    ...(p.cv ? ["cv-analysis" as const] : []),
    "roles",
    ...p.roles.flatMap((r) => [experienceStep(r.title), levelStep(r.title)]),
    "direction",
    "work-modes",
    "work",
    "residence",
    ...(p.workModes.includes("remote")
      ? ["location" as const, "overlap" as const]
      : []),
    ...(p.workModes.some((m) => m !== "remote") ? ["in-person" as const] : []),
    ...relevantCountries(p).flatMap((country) => {
      const answer = p.countryAnswers[country];
      return [
        countryStep(country),
        ...(answer && ["yes", "no"].includes(answer.authorization)
          ? [`sponsor:${encodeURIComponent(country)}` as Step]
          : []),
        ...(answer?.sponsorshipNow === "no" && answer.authorization === "yes"
          ? [`future:${encodeURIComponent(country)}` as Step]
          : []),
      ];
    }),
    "preferences",
    ...(p.employment.length ? ["compensation" as const] : []),
    ...(p.payEnabled
      ? p.employment.flatMap((b) =>
          (["currency", "period", "minimum", "target"] as const).map((q) =>
            payStep(b, q),
          ),
        )
      : []),
    "review",
  ];
}
export function shouldAsk(step: Step, p: Profile): boolean {
  if (step.startsWith("experience:"))
    return !p.roles.find((r) => experienceStep(r.title) === step)
      ?.experienceConfirmedAt;
  return !p.confirmations[step];
}
export function payFor(p: Profile, basis: Employment) {
  return p.payByEmployment[basis] ?? { ...blankPay(), confirmedUnits: "" };
}
export function countryForStep(step: Step, p: Profile) {
  return relevantCountries(p).find((c) =>
    [
      countryStep(c),
      `sponsor:${encodeURIComponent(c)}`,
      `future:${encodeURIComponent(c)}`,
    ].includes(step),
  );
}
export function editProfile(
  profile: Profile,
  patch: Partial<Profile>,
  now = new Date().toISOString(),
): Profile {
  const updated = { ...profile, ...patch, confirmedAt: "", updatedAt: now };
  const confirmations = { ...profile.confirmations, ...patch.confirmations };
  if (patch.country !== undefined && patch.country !== profile.country) {
    delete confirmations.location;
    delete confirmations.overlap;
  }
  if (patch.residence !== undefined && patch.residence !== profile.residence)
    delete confirmations.residence;
  if (patch.cv !== undefined && patch.cv?.hash !== profile.cv?.hash) {
    delete confirmations.cv;
    delete confirmations["cv-analysis"];
  }
  if (patch.roles !== undefined) delete confirmations.roles;
  if (patch.workModes !== undefined) delete confirmations["work-modes"];
  if (patch.employment !== undefined) delete confirmations.work;
  if (patch.payByEmployment)
    for (const [basis, pay] of Object.entries(patch.payByEmployment)) {
      const previous = profile.payByEmployment[basis];
      if (
        previous &&
        (previous.currency !== pay.currency || previous.period !== pay.period)
      ) {
        updated.payByEmployment = {
          ...updated.payByEmployment,
          [basis]: { ...pay, confirmedUnits: "" },
        };
        for (const question of ["minimum", "target"])
          delete confirmations[`pay:${basis}:${question}`];
      }
    }
  if (patch.roles) {
    const drafts = { ...profile.roleDrafts };
    for (const role of profile.roles) drafts[role.title] = role;
    updated.roleDrafts = drafts;
    updated.roles = patch.roles.map((role) =>
      profile.roles.some((r) => r.title === role.title)
        ? role
        : (drafts[role.title] ?? role),
    );
    for (const role of patch.roles) {
      const old = profile.roles.find((r) => r.title === role.title);
      if (old && old.level !== role.level)
        delete confirmations[levelStep(role.title)];
      if (old && old.experienceLevel !== role.experienceLevel)
        delete confirmations[experienceStep(role.title)];
    }
  }
  if (patch.countryAnswers)
    for (const [country, answer] of Object.entries(patch.countryAnswers)) {
      const old = profile.countryAnswers[country];
      if (old && old.authorization !== answer.authorization) {
        delete confirmations[`sponsor:${encodeURIComponent(country)}`];
        delete confirmations[`future:${encodeURIComponent(country)}`];
      }
      if (old && old.sponsorshipNow !== answer.sponsorshipNow)
        delete confirmations[`future:${encodeURIComponent(country)}`];
    }
  if (patch.inPersonCountries) delete confirmations["in-person"];
  if (patch.overlap !== undefined && patch.overlap !== profile.overlap)
    delete confirmations.overlap;
  if (
    patch.availability !== undefined &&
    patch.availability !== profile.availability
  )
    delete confirmations.preferences;
  // A deliberate confirmation in the same action supersedes invalidation.
  updated.confirmations = { ...confirmations, ...patch.confirmations };
  return updated;
}
export function validSampleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validationFor(step: Step, p: Profile): string | null {
  if (step === "cv-review" && p.cv && !p.cv.reviewedAt)
    return "Review the extracted text, then confirm it or leave this for later.";
  const salary = payForStep(step);
  if (salary && p.payEnabled) {
    const pay = payFor(p, salary.basis);
    if (
      salary.question === "currency" &&
      !Intl.supportedValuesOf("currency").includes(pay.currency)
    )
      return "Choose a currency, or set compensation preferences later.";
    if (salary.question === "period" && !pay.period)
      return "Choose a pay period, or set compensation preferences later.";
    if (salary.question === "minimum" || salary.question === "target") {
      const amount = pay[salary.question];
      if (amount && !validAmount(amount))
        return "Enter a positive exact amount using digits and an optional decimal point. Your entry has not been changed.";
      if (
        salary.question === "target" &&
        pay.minimum &&
        amount &&
        validAmount(pay.minimum) &&
        validAmount(amount) &&
        compareAmounts(pay.minimum, amount) > 0
      )
        return "Your target should be at least your private minimum. Edit either amount; neither has been changed.";
    }
  }
  if (
    step === "sample-url" &&
    p.sampleChoice === "add" &&
    !validSampleUrl(p.sampleUrl)
  )
    return "Add a complete https:// work-sample link, or leave work samples for later.";
  if (
    step === "contribution" &&
    p.sampleChoice === "add" &&
    !p.contribution.trim()
  )
    return "Briefly describe what you contributed to this work, or leave work samples for later.";
  return null;
}
export function profileGaps(p: Profile): string[] {
  return [
    !p.roles.length ? "Choose a search direction" : "",
    !p.workModes.length ? "Choose a work mode" : "",
    p.workModes.includes("remote") && !p.country.trim()
      ? "Remote working country not set"
      : "",
    p.workModes.some((m) => m !== "remote") && !p.inPersonCountries.length
      ? "In-person destinations not set"
      : "",
    !p.employment.length ? "Employment preferences not set" : "",
    ...relevantCountries(p)
      .filter(
        (c) =>
          !p.countryAnswers[c]?.authorization ||
          p.countryAnswers[c]?.authorization === "unsure",
      )
      .map((c) => `Work authorization in ${c} needs confirmation`),
  ].filter(Boolean);
}
export function reviewIssue(
  p: Profile,
): { step: Step; message: string } | null {
  for (const step of stepsFor(p).filter((step) => step !== "cv-review")) {
    const message = validationFor(step, p);
    if (message) return { step, message };
  }
  return null;
}

// Monetary strings retain their precision; compare whole units without floating-point rounding.
function scaledAmount(value: string, scale: number): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0") || "0")
  );
}
export function validAmount(value: string) {
  return /^\d+(\.\d+)?$/.test(value) && /[1-9]/.test(value);
}
export function compareAmounts(left: string, right: string) {
  const scale = Math.max(
    left.split(".")[1]?.length ?? 0,
    right.split(".")[1]?.length ?? 0,
  );
  const a = scaledAmount(left, scale),
    b = scaledAmount(right, scale);
  return a < b ? -1 : a > b ? 1 : 0;
}
export function salaryRange(amount: string, period: string) {
  const base = period === "hour" ? 500 : period === "month" ? 20_000 : 250_000;
  const valid = amount === "" || /^\d+(\.\d+)?$/.test(amount);
  const scale = Math.max(2, amount.split(".")[1]?.length ?? 0);
  // Native ranges have finite precision. Keep larger or more precise typed amounts unchanged.
  const supported =
    valid &&
    scale <= 6 &&
    (!amount || scaledAmount(amount, scale) <= 100_000_000_000_000n);
  const value = supported && amount ? Number(amount) : 0;
  const max = Math.max(base, Math.ceil(value / base) * base);
  return { supported, value, max, step: 10 ** -Math.min(scale, 6) };
}

export const newRole = (title: string) => ({
  title,
  level: "",
  experienceLevel: "",
  experienceConfirmedAt: "",
});
export const blankCountryAnswer = () => ({
  authorization: "" as const,
  sponsorshipNow: "" as const,
  sponsorshipLater: "" as const,
  confirmedAt: "",
});
export const experienceStep = (title: string): Step =>
  `experience:${encodeURIComponent(title)}`;
export const countryStep = (country: string): Step =>
  `country:${encodeURIComponent(country)}`;
export function migrateProfile(value: unknown): Profile {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version === 1
  ) {
    const old = Schema.decodeUnknownSync(LegacyProfile)(value);
    const base = emptyProfile();
    return {
      ...base,
      ...old,
      version: 2,
      setupCompletedAt: old.confirmedAt,
      roles: old.roles.map((role) => ({ ...newRole(role.title), ...role })),
      workModes: old.updatedAt ? ["remote"] : [],
      countryAnswers: old.country
        ? {
            [old.country]: {
              authorization:
                old.authorization === "yes" ? "unsure" : old.authorization,
              sponsorshipNow: old.sponsorshipNow,
              sponsorshipLater: old.sponsorshipLater,
              confirmedAt: old.updatedAt,
            },
          }
        : {},
      payByEmployment: {
        "full-time": { ...old.fullTimePay, confirmedUnits: "" },
        contract: { ...old.contractPay, confirmedUnits: "" },
      },
    };
  }
  const p = Schema.decodeUnknownSync(Profile)(value);
  return p.analysis.status === "running"
    ? {
        ...p,
        analysis: {
          ...p.analysis,
          status: "failed",
          message: "Analysis was interrupted. Retry when you’re ready.",
        },
      }
    : p;
}
export function effectiveFact(p: Profile, fact: CvAnalysis["facts"][number]) {
  const correction = p.corrections.findLast(
    (c) =>
      c.factId === fact.id && c.sourceHash === p.analysis.result?.sourceHash,
  );
  return {
    value: correction?.value ?? fact.value,
    status: correction?.status ?? "source_stated",
  };
}

export function payUnits(pay: ReturnType<typeof payFor>) {
  return `${pay.currency}:${pay.period}`;
}
export function confirmStep(
  p: Profile,
  step: Step,
  now = new Date().toISOString(),
): Partial<Profile> {
  if (!hasAnswer(p, step)) return {};
  const patch: { -readonly [K in keyof Profile]?: Profile[K] } = {
    confirmations: { ...p.confirmations, [step]: now },
    skipped: p.skipped.filter((s) => s !== step),
  };
  const salary = payForStep(step);
  if (
    salary &&
    (salary.question === "minimum" || salary.question === "target")
  ) {
    const pay = payFor(p, salary.basis);
    const confirmations = patch.confirmations!;
    if (
      pay.currency &&
      pay.period &&
      confirmations[payStep(salary.basis, "minimum")] &&
      (!pay.target || confirmations[payStep(salary.basis, "target")])
    )
      patch.payByEmployment = {
        ...p.payByEmployment,
        [salary.basis]: { ...pay, confirmedUnits: payUnits(pay) },
      };
  }
  const role = p.roles.find((r) => experienceStep(r.title) === step);
  if (role?.experienceLevel)
    patch.roles = p.roles.map((r) =>
      r.title === role.title ? { ...r, experienceConfirmedAt: now } : r,
    );
  return patch;
}
export function skipStep(p: Profile, step: Step): Partial<Profile> {
  const confirmations = { ...p.confirmations };
  delete confirmations[step];
  return { confirmations, skipped: [...new Set([...p.skipped, step])] };
}

function hasAnswer(p: Profile, step: Step): boolean {
  const role = roleForStep(step, p);
  if (role) return !!role.level;
  const experience = p.roles.find((r) => experienceStep(r.title) === step);
  if (experience) return !!experience.experienceLevel;
  const country = countryForStep(step, p);
  if (country) {
    const a = p.countryAnswers[country];
    return !!(step.startsWith("country:")
      ? a?.authorization
      : step.startsWith("sponsor:")
        ? a?.sponsorshipNow
        : a?.sponsorshipLater);
  }
  const salary = payForStep(step);
  if (salary)
    return (
      !!payFor(p, salary.basis)[salary.question] || salary.question === "target"
    );
  switch (step) {
    case "goal":
      return !!p.goal;
    case "cv":
      return !!p.cv;
    case "cv-analysis":
      return !!p.analysis.result;
    case "cv-review":
      return !!p.cv?.reviewedAt;
    case "cv-notes":
      return !!p.cv?.notes.trim();
    case "roles":
      return !!p.roles.length;
    case "work-modes":
      return !!p.workModes.length;
    case "work":
      return !!p.employment.length;
    case "in-person":
      return !!p.inPersonCountries.length;
    case "location":
      return !!p.country.trim();
    case "residence":
      return !!p.residence.trim();
    case "overlap":
      return !!p.overlap.trim();
    case "preferences":
      return !!p.availability;
    case "travel":
      return !!p.travel;
    case "exclusions":
      return !!p.exclusions.trim();
    case "compensation":
      return p.payEnabled || p.visited.includes(step);
    case "evidence":
      return !!p.sampleChoice;
    case "sample-url":
      return !!p.sampleUrl.trim();
    case "contribution":
      return !!p.contribution.trim();
    case "direction":
    case "cv-story":
      return true;
    default:
      return false;
  }
}
// Corrections leave source facts intact and retire only interpretations using changed evidence.
export function effectiveAnalysis(p: Profile): CvAnalysis | null {
  const result = p.analysis.result;
  if (!result || result.sourceHash !== p.cv?.hash) return null;
  const affected = new Set(
    result.facts
      .filter((f) => {
        const c = p.corrections.findLast(
          (c) => c.sourceHash === result.sourceHash && c.factId === f.id,
        );
        return c && (c.status === "candidate_denied" || c.value !== f.value);
      })
      .flatMap((f) => f.evidenceIds),
  );
  if (!affected.size) return result;
  const supported = (item: { evidenceIds: readonly string[] }) =>
    !item.evidenceIds.some((id) => affected.has(id));
  return {
    ...result,
    snapshot: result.snapshot.filter(supported),
    roles: result.roles.filter(supported),
    findings: result.findings.filter(supported),
    limitations: [
      ...result.limitations,
      "Interpretations relying on corrected or rejected source facts are hidden. Your original source and corrections remain available separately.",
    ],
  };
}
