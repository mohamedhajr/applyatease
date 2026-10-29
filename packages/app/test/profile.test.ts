import { describe, expect, it } from "vitest";
import { emptyProfile } from "../src/onboarding/model.ts";
import { profileCompletion } from "../src/profile/completion.ts";

describe("applicable profile completion", () => {
  it("does not count inactive branches or absent model output as provided", () => {
    const items = profileCompletion(emptyProfile());
    expect(items.every((item) => item.state === "unknown")).toBe(true);
    expect(items.some((item) => item.id === "remote-location")).toBe(false);
    expect(items.some((item) => item.id === "in-person")).toBe(false);
    expect(items.some((item) => item.id.startsWith("pay:"))).toBe(false);
  });

  it("keeps skipped optional input distinct from unknown and provided", () => {
    const blank = emptyProfile();
    const skipped = profileCompletion({ ...blank, skipped: ["preferences"] });
    expect(skipped.find((item) => item.id === "availability")?.state).toBe(
      "skipped",
    );
    expect(skipped.find((item) => item.id === "residence")?.state).toBe(
      "unknown",
    );
    expect(
      skipped
        .filter((item) => item.purpose === "Needed for search")
        .every((item) => item.state === "unknown"),
    ).toBe(true);
  });

  it("counts both location paths only when both modes are active", () => {
    const blank = emptyProfile();
    const mixed = profileCompletion({
      ...blank,
      workModes: ["remote", "hybrid"],
    });
    expect(mixed.find((item) => item.id === "modes")?.state).toBe("provided");
    expect(mixed.some((item) => item.id === "remote-location")).toBe(true);
    expect(mixed.some((item) => item.id === "in-person")).toBe(true);
    expect(mixed.some((item) => item.id === "overlap")).toBe(true);
    const inPerson = profileCompletion({ ...blank, workModes: ["on-site"] });
    expect(
      inPerson.some(
        (item) => item.id === "remote-location" || item.id === "overlap",
      ),
    ).toBe(false);
    expect(inPerson.some((item) => item.id === "in-person")).toBe(true);
  });

  it("only activates compensation for selected employment types", () => {
    const items = profileCompletion({
      ...emptyProfile(),
      employment: ["part-time", "short-contract"],
      payEnabled: true,
    });
    expect(
      items.filter((item) => item.id.startsWith("pay:")).map((item) => item.id),
    ).toEqual(["pay:part-time", "pay:short-contract"]);
    expect(
      items.find((item) => item.id === "pay:short-contract")?.label,
    ).toContain("Short-term contract");
  });
});
