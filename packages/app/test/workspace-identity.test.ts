import { expect, it } from "vitest";
import {
  emptyWorkspace,
  mergeSource,
  normalizedUrl,
  archiveAnswerDrafts,
} from "../src/workspace/model.ts";
import type { SourceCapture } from "@applyatease/contracts/workflow";
import { workflowProfile, sourceHost } from "../src/workspace/model.ts";
import { emptyProfile } from "../src/onboarding/model.ts";

it("renders malformed returned source URLs without losing the workspace", () => {
  expect(sourceHost("not a URL")).toBe("Invalid source URL");
  expect(sourceHost("https://source.invalid/posting")).toBe("source.invalid");
});

it("keeps unconfirmed personal targets out of search while labeling research selections", async () => {
  const profile = {
    ...emptyProfile(),
    roles: [
      {
        title: "DevOps Engineer",
        level: "",
        experienceLevel: "",
        experienceConfirmedAt: "",
      },
    ],
  };
  expect(
    (await workflowProfile(profile, "user:boundary", false)).targets,
  ).toEqual([]);
  const research = await workflowProfile(profile, "research:boundary", true);
  expect(research.targets).toHaveLength(1);
  expect(research.targets[0]).toContain("researcher-selected");
  expect(research.source.sourceHash).toBe("");
  expect(research.confirmedFacts).toEqual([]);
});

const unavailable: SourceCapture = {
  id: "unverified-input",
  originalUrl: "https://source.invalid/original",
  finalUrl: "https://source.invalid/old",
  canonicalUrl: "https://source.invalid/old",
  retrievedAt: "",
  hash: "",
  text: "",
  status: "unverified",
  httpStatus: 0,
  limitations: [],
};
it("refreshes the selected identity even when its destination changes", () => {
  const initial = mergeSource(emptyWorkspace(), unavailable, "");
  const refreshed = mergeSource(
    initial,
    {
      ...unavailable,
      finalUrl: "https://source.invalid/new",
      canonicalUrl: "https://source.invalid/new",
    },
    "",
    initial.selectedId,
  );
  expect(refreshed.opportunities).toHaveLength(1);
  expect(refreshed.selectedId).toBe(initial.selectedId);
  expect(refreshed.opportunities[0]?.sourceHistory).toEqual([unavailable]);
  expect(refreshed.opportunities[0]?.source.canonicalUrl).toBe(
    "https://source.invalid/new",
  );
});
it("deduplicates repeated unverified URL imports without inventing an assessment", () => {
  const initial = mergeSource(emptyWorkspace(), unavailable, "");
  const repeated = mergeSource(initial, unavailable, "");
  expect(repeated.opportunities).toHaveLength(1);
  expect(repeated.opportunities[0]?.assessment).toBeNull();
});

it("preserves resource query identifiers when merging source captures", () => {
  for (const key of ["ref", "source"]) {
    const original = {
      ...unavailable,
      canonicalUrl: `https://source.invalid/path?${key}=one`,
      finalUrl: `https://source.invalid/path?${key}=one`,
    };
    const first = mergeSource(emptyWorkspace(), original, "");
    const second = mergeSource(
      first,
      {
        ...original,
        canonicalUrl: `https://source.invalid/path?${key}=two`,
        finalUrl: `https://source.invalid/path?${key}=two`,
      },
      "",
    );
    expect(second.opportunities).toHaveLength(2);
    expect(second.opportunities[0]?.source.canonicalUrl).toBe(
      original.canonicalUrl,
    );
  }
  expect(
    normalizedUrl(
      "https://source.invalid/path?ref=one&utm_source=a&gclid=b&fbclid=c#section",
    ),
  ).toBe("https://source.invalid/path?ref=one");
});
it("retains draft history and clears active wording before another preparation", () => {
  const prior = {
    opportunityId: "prior",
    savedAt: "",
    requirements: null,
    drafts: { value: "Earlier wording" },
  };
  const job = {
    id: "current",
    updatedAt: "",
    requirements: null,
    preparation: null,
    draftHistory: [prior],
    answerDrafts: { value: "Wording to retain" },
  };
  const archived = archiveAnswerDrafts(job);
  expect(archived.answerDrafts).toEqual({});
  expect(archived.draftHistory).toEqual([
    prior,
    {
      opportunityId: job.id,
      savedAt: job.updatedAt,
      requirements: null,
      preparation: null,
      drafts: job.answerDrafts,
    },
  ]);
  expect(job.answerDrafts).toEqual({ value: "Wording to retain" });
  expect(archiveAnswerDrafts({ ...job, ...archived }).draftHistory).toEqual(
    archived.draftHistory,
  );
});
