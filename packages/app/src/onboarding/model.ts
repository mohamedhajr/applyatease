import { Schema } from "effect";

export const Employment = Schema.Literals(["full-time", "contract"]);
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
export function payForStep(step: Step) {
  for (const basis of ["full-time", "contract"] as const) {
    for (const question of [
      "currency",
      "period",
      "minimum",
      "target",
    ] as const) {
      if (step === payStep(basis, question))
        return {
          basis,
          question,
          key:
            basis === "full-time"
              ? ("fullTimePay" as const)
              : ("contractPay" as const),
        };
    }
  }
  return null;
}
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
export const Profile = Schema.Struct({
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
export type Profile = typeof Profile.Type;
export const blankPay = () => ({
  minimum: "",
  target: "",
  currency: "",
  period: "" as const,
});
export function emptyProfile(): Profile {
  return {
    version: 1,
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
export function stepsFor(profile: Profile): Step[] {
  return [
    "goal",
    "cv",
    ...(profile.cv
      ? ["cv-review" as const, "cv-notes" as const, "cv-story" as const]
      : []),
    "roles",
    ...profile.roles.map((role) => levelStep(role.title)),
    "direction",
    "location",
    "residence",
    "timezone",
    "overlap",
    "work",
    ...(profile.country.trim() && profile.employment.includes("full-time")
      ? [
          "eligibility" as const,
          "sponsorship-now" as const,
          "sponsorship-later" as const,
        ]
      : []),
    "preferences",
    "travel",
    "exclusions",
    ...(profile.employment.length ? ["compensation" as const] : []),
    ...(profile.payEnabled
      ? profile.employment.flatMap((basis) =>
          (["currency", "period", "minimum", "target"] as const).map(
            (question) => payStep(basis, question),
          ),
        )
      : []),
    "evidence",
    ...(profile.sampleChoice === "add"
      ? ["sample-url" as const, "contribution" as const]
      : []),
    "review",
  ];
}
export function editProfile(
  profile: Profile,
  patch: Partial<Profile>,
  now = new Date().toISOString(),
): Profile {
  const updated = { ...profile, ...patch, confirmedAt: "", updatedAt: now };
  // Eligibility statements are scoped to the working country, not residence.
  if (patch.country !== undefined && patch.country !== profile.country) {
    updated.authorization = "";
    updated.sponsorshipNow = "";
    updated.sponsorshipLater = "";
  }
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
  if (step === "roles" && p.roles.length === 0)
    return "Choose at least one role, or add your own title.";
  if (step === "cv-review" && p.cv && !p.cv.reviewedAt)
    return "Review the extracted text, then confirm it or leave this for later.";
  const salary = payForStep(step);
  if (salary && p.payEnabled) {
    const pay = p[salary.key];
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
    !p.cv ? "CV not added" : !p.cv.reviewedAt ? "CV text needs review" : "",
    !p.roles.length ? "Target roles not set" : "",
    !p.country.trim() ? "Working country not set" : "",
    !p.timezone.trim() ? "Time zone not set" : "",
    !p.employment.length ? "Employment preference not set" : "",
    p.employment.includes("full-time") &&
    p.country &&
    (!p.authorization || !p.sponsorshipNow || !p.sponsorshipLater)
      ? "Employment eligibility needs confirmation"
      : "",
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
