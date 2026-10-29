import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  compareAmounts,
  newRole,
  confirmStep,
  skipStep,
  shouldAsk,
  payFor,
  payUnits,
  migrateProfile,
  relevantCountries,
  countryStep,
  blankCountryAnswer,
  editProfile,
  emptyProfile,
  levelStep,
  payStep,
  Profile,
  reviewIssue,
  salaryRange,
  stepsFor,
  validationFor,
  validSampleUrl,
} from "../src/onboarding/model.ts";

describe("search profile rules", () => {
  it("starts without inferred facts or application approval", () => {
    const p = emptyProfile();
    expect(p.roles).toEqual([]);
    expect(p.authorization).toBe("");
    expect(p.confirmedAt).toBe("");
    expect(stepsFor(p)).not.toContain("cv-review");
    expect(stepsFor(p)).not.toContain("eligibility");
    expect("approval" in p).toBe(false);
  });
  it("keeps the prior storage shape and resume identifiers readable", () => {
    const saved: Profile = { ...emptyProfile(), step: "preferences" };
    expect(Schema.decodeSync(Profile)(saved)).toEqual(saved);
    expect(stepsFor(Schema.decodeSync(Profile)(saved))).toContain(
      "preferences",
    );
  });
  it("asks each role level separately with stable identifiers", () => {
    const p = {
      ...emptyProfile(),
      roles: [
        { ...newRole("DevOps Engineer"), level: "Senior" },
        newRole("Video Editor"),
      ],
    };
    const steps = stepsFor(p);
    expect(steps.indexOf(levelStep("Video Editor"))).toBe(
      steps.indexOf(levelStep("DevOps Engineer")) + 2,
    );
    expect(stepsFor({ ...p, roles: [p.roles[1]!] })).toContain(
      levelStep("Video Editor"),
    );
    expect(
      Schema.decodeSync(Profile)({
        ...p,
        step: levelStep("DevOps Engineer"),
      }).roles[0]?.level,
    ).toBe("Senior");
  });
  it("invalidates confirmation and only dependent country-scoped answers", () => {
    const p = {
      ...emptyProfile(),
      country: "Egypt",
      authorization: "yes" as const,
      sponsorshipNow: "no" as const,
      sponsorshipLater: "unsure" as const,
      confirmedAt: "previously reviewed",
      goal: "explore" as const,
      timezone: "Africa/Cairo",
    };
    const changed = editProfile(p, { country: "United Arab Emirates" });
    expect(changed.confirmedAt).toBe("");
    expect(changed.authorization).toBe(p.authorization);
    expect(changed.sponsorshipNow).toBe(p.sponsorshipNow);
    expect(changed.sponsorshipLater).toBe(p.sponsorshipLater);
    expect(changed.goal).toBe(p.goal);
    expect(changed.timezone).toBe(p.timezone);
  });
  it("validates each pay question against its employment basis", () => {
    const p = {
      ...emptyProfile(),
      employment: ["contract" as const],
      payEnabled: true,
      payByEmployment: {
        contract: {
          confirmedUnits: "",
          minimum: "35000",
          target: "30000",
          currency: "AED",
          period: "month" as const,
        },
      },
    };
    expect(validationFor(payStep("contract", "minimum"), p)).toBeNull();
    expect(validationFor(payStep("contract", "target"), p)).toMatch(/target/);
    expect(
      validationFor(payStep("contract", "currency"), {
        ...p,
        payByEmployment: {
          contract: { ...p.payByEmployment.contract, currency: "" },
        },
      }),
    ).toMatch(/currency/);
    expect(
      validationFor(payStep("contract", "period"), {
        ...p,
        payByEmployment: {
          contract: { ...p.payByEmployment.contract, period: "" },
        },
      }),
    ).toMatch(/period/);
    expect(
      validationFor(payStep("contract", "minimum"), {
        ...p,
        payByEmployment: {
          contract: { ...p.payByEmployment.contract, minimum: "35k" },
        },
      }),
    ).toMatch(/digits/);
    expect(
      reviewIssue({ ...p, roles: [newRole("DevOps Engineer")] })?.step,
    ).toBe(payStep("contract", "target"));
  });
  it("preserves decimal precision and expands the range without clamping", () => {
    expect(compareAmounts("35000.1234567", "35000.1234568")).toBe(-1);
    expect(compareAmounts("35000.750", "35000.75")).toBe(0);
    expect(salaryRange("1234567.89", "year")).toMatchObject({
      supported: true,
      value: 1234567.89,
      max: 1250000,
      step: 0.01,
    });
    expect(salaryRange("35000.125", "month")).toMatchObject({
      supported: true,
      step: 0.001,
    });
    expect(salaryRange("10000000000000000000.01", "month").supported).toBe(
      false,
    );
    expect(salaryRange("35000.1234567", "month").supported).toBe(false);
    expect(salaryRange("0", "month").supported).toBe(true);
    expect(salaryRange("", "month").value).toBe(0);
  });
  it("rejects executable and credential-bearing sample URLs", () => {
    expect(validSampleUrl("javascript:alert(1)")).toBe(false);
    expect(validSampleUrl("https://name:secret@example.org")).toBe(false);
    expect(validSampleUrl("https://github.com/")).toBe(true);
  });
  it("allows entering the profile with optional gaps", () => {
    const p = emptyProfile();
    expect(reviewIssue(p)).toBeNull();
    expect(
      reviewIssue({ ...p, roles: [newRole("DevOps Engineer")] }),
    ).toBeNull();
  });
});

describe("scoped onboarding", () => {
  it("keeps physical countries separate and never restores a timezone screen", () => {
    const p: Profile = {
      ...emptyProfile(),
      workModes: ["remote", "hybrid"],
      country: "Egypt",
      inPersonCountries: ["Germany"],
      employment: ["part-time"],
    };
    expect(relevantCountries(p)).toEqual(["Egypt", "Germany"]);
    expect(stepsFor(p)).toContain("overlap");
    expect(stepsFor(p)).not.toContain("timezone");
    expect(stepsFor({ ...p, workModes: ["on-site"] })).not.toContain("overlap");
    expect(relevantCountries({ ...p, employment: ["short-contract"] })).toEqual(
      [],
    );
    const changed = editProfile(
      {
        ...p,
        countryAnswers: {
          Egypt: { ...blankCountryAnswer(), authorization: "unrestricted" },
        },
      },
      { country: "Canada" },
    );
    expect(relevantCountries(changed)).toEqual(["Canada", "Germany"]);
    expect(changed.countryAnswers.Egypt?.authorization).toBe("unrestricted");
    expect(stepsFor(p)).toContain(countryStep("Egypt"));
  });
  it("keeps skipped, confirmed, and missing scopes distinct", () => {
    expect(confirmStep(emptyProfile(), "location")).toEqual({});
    const p = { ...emptyProfile(), country: "Egypt" };
    const confirmed = { ...p, ...confirmStep(p, "location") };
    expect(shouldAsk("location", confirmed)).toBe(false);
    const skipped = { ...confirmed, ...skipStep(confirmed, "location") };
    expect(skipped.skipped).toContain("location");
    expect(shouldAsk("location", skipped)).toBe(true);
    expect(
      shouldAsk("location", editProfile(confirmed, { country: "Canada" })),
    ).toBe(true);
  });
  it("retains role drafts and completed setup during focused edits", () => {
    const p = {
      ...emptyProfile(),
      setupCompletedAt: "saved",
      roles: [
        {
          ...newRole("DevOps Engineer"),
          level: "Senior",
          experienceLevel: "Mid level",
        },
      ],
    };
    const removed = editProfile(p, { roles: [] });
    const added = editProfile(removed, { roles: [newRole("DevOps Engineer")] });
    expect(added.roles[0]?.level).toBe("Senior");
    expect(added.roles[0]?.experienceLevel).toBe("Mid level");
    expect(added.setupCompletedAt).toBe("saved");
  });
  it("requires renewed amount confirmation when pay units change without rounding drafts", () => {
    let p: Profile = {
      ...emptyProfile(),
      employment: ["internship"],
      payEnabled: true,
      payByEmployment: {
        internship: {
          currency: "USD",
          period: "month",
          minimum: "35000.1234567",
          target: "",
          confirmedUnits: "",
        },
      },
    };
    p = { ...p, ...confirmStep(p, payStep("internship", "minimum")) };
    expect(payFor(p, "internship").confirmedUnits).toBe(
      payUnits(payFor(p, "internship")),
    );
    p = { ...p, ...confirmStep(p, payStep("internship", "target")) };
    expect(payFor(p, "internship").confirmedUnits).toBe(
      payUnits(payFor(p, "internship")),
    );
    const changed = editProfile(p, {
      payByEmployment: {
        internship: { ...payFor(p, "internship"), currency: "EUR" },
      },
    });
    expect(payFor(changed, "internship").confirmedUnits).toBe("");
    expect(payFor(changed, "internship").minimum).toBe("35000.1234567");
    expect(shouldAsk(payStep("internship", "minimum"), changed)).toBe(true);
  });
  it("migrates old general authorization without asserting restricted authorization", () => {
    const legacy = {
      ...emptyProfile(),
      version: 1,
      country: "Egypt",
      authorization: "yes",
      updatedAt: "saved",
      confirmedAt: "done",
      roles: [{ title: "DevOps Engineer", level: "Senior" }],
    };
    const migrated = migrateProfile(legacy);
    expect(migrated.countryAnswers.Egypt?.authorization).toBe("unsure");
    expect(migrated.setupCompletedAt).toBe("done");
    expect(migrated.roles[0]?.experienceLevel).toBe("");
  });
});
