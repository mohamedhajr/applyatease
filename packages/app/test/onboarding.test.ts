import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  compareAmounts,
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
        { title: "DevOps Engineer", level: "Senior" },
        { title: "Video Editor", level: "" },
      ],
    };
    const steps = stepsFor(p);
    expect(steps.indexOf(levelStep("Video Editor"))).toBe(
      steps.indexOf(levelStep("DevOps Engineer")) + 1,
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
    expect(changed.authorization).toBe("");
    expect(changed.sponsorshipNow).toBe("");
    expect(changed.sponsorshipLater).toBe("");
    expect(changed.goal).toBe(p.goal);
    expect(changed.timezone).toBe(p.timezone);
  });
  it("validates each pay question against its employment basis", () => {
    const p = {
      ...emptyProfile(),
      employment: ["contract" as const],
      payEnabled: true,
      contractPay: {
        minimum: "35000",
        target: "30000",
        currency: "AED",
        period: "month" as const,
      },
    };
    expect(validationFor(payStep("contract", "minimum"), p)).toBeNull();
    expect(validationFor(payStep("contract", "target"), p)).toMatch(/target/);
    expect(
      validationFor(payStep("contract", "currency"), {
        ...p,
        contractPay: { ...p.contractPay, currency: "" },
      }),
    ).toMatch(/currency/);
    expect(
      validationFor(payStep("contract", "period"), {
        ...p,
        contractPay: { ...p.contractPay, period: "" },
      }),
    ).toMatch(/period/);
    expect(
      validationFor(payStep("contract", "minimum"), {
        ...p,
        contractPay: { ...p.contractPay, minimum: "35k" },
      }),
    ).toMatch(/digits/);
    expect(
      reviewIssue({ ...p, roles: [{ title: "DevOps Engineer", level: "" }] })
        ?.step,
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
  it("leaves irrelevant missing facts nonblocking, but requires a search direction", () => {
    const p = emptyProfile();
    expect(reviewIssue(p)?.step).toBe("roles");
    expect(
      reviewIssue({ ...p, roles: [{ title: "DevOps Engineer", level: "" }] }),
    ).toBeNull();
  });
});
