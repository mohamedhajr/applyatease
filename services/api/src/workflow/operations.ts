import { createHash, randomUUID } from "node:crypto";
import {
  SearchPlan,
  DiscoveryLeads,
  Assessment,
  Requirements,
  Preparation,
  type WorkflowProfile,
  type SourceCapture,
  type Citation,
} from "@applyatease/contracts/workflow";
import { runSkill, runValidatedSkill } from "./model.ts";
import {
  captureSource,
  verifyCapture,
  observedRequired,
  hasRequisitionEvidence,
} from "./source.ts";
const inspectedRequirements = new Map<string, string>();
function validateProfile(profile: WorkflowProfile) {
  if (
    !profile.source.sourceHash &&
    profile.source.sections.some((s) => s.text.trim())
  )
    throw new Error(
      "CV evidence needs its original source hash. Import the source again.",
    );
  if (
    profile.researchOnly &&
    (profile.confirmedFacts.length || profile.factResolutions?.length)
  )
    throw new Error("Research profiles cannot carry applicant confirmations.");
  if (
    profile.factResolutions?.some(
      (f) => f.sourceHash !== profile.source.sourceHash,
    )
  )
    throw new Error(
      "Profile resolutions belong to a different CV source. Refresh the profile.",
    );
  if (
    profile.source.sections.reduce((total, s) => total + s.text.length, 0) >
    250000
  )
    throw new Error("CV evidence exceeds the workflow limit.");
}
const normalized = (s: string) => s.replace(/\s+/g, " ").trim();
function validateCitations(
  citations: readonly (typeof Citation.Type)[],
  profile: WorkflowProfile | undefined,
  job: SourceCapture | undefined,
  form?: SourceCapture,
) {
  for (const e of citations) {
    const text =
      e.source === "cv"
        ? profile?.source.sections.find((s) => s.label === e.section)?.text
        : e.source === "job"
          ? job?.text
          : form?.text;
    if (
      !text ||
      !normalized(e.quote) ||
      !normalized(text).includes(normalized(e.quote))
    )
      throw new Error(
        "The model returned a quote absent from its source. Result rejected; retry the operation.",
      );
  }
}
function verified(source: SourceCapture) {
  verifyCapture(source);
  if (source.status !== "inspected" || !source.text || !source.hash)
    throw new Error("A successfully inspected source is required.");
  if (
    Date.now() - Date.parse(source.retrievedAt) > 24 * 60 * 60 * 1000 ||
    !Number.isFinite(Date.parse(source.retrievedAt))
  )
    throw new Error(
      "Refresh this source before continuing; its capture is stale.",
    );
}
export async function plan(profile: WorkflowProfile, signal?: AbortSignal) {
  validateProfile(profile);
  return runSkill(
    SearchPlan,
    "Create up to five useful job-search queries from targets and usable preferences. List only consequential missing search constraints without inventing them. CV availability is supplied below: when present, do not ask the applicant to provide their experience or qualifications again and do not claim no candidate evidence was supplied. Detailed qualification mapping belongs to the later assessment of each full posting; a search plan does not need to repeat that intake. Keep each target's level separate.",
    {
      targets: profile.targets,
      preferences: profile.preferences,
      cvEvidence: {
        available: profile.source.sections.some((section) =>
          section.text.trim(),
        ),
        sections: profile.source.sections.map((section) => section.label),
        extractionLimitations: profile.source.warnings,
      },
    },
    profile.version,
    profile.source.sourceHash ? [profile.source.sourceHash] : [],
    false,
    signal,
  );
}
export async function discover(
  profile: WorkflowProfile,
  searchPlan: SearchPlan,
  signal?: AbortSignal,
) {
  validateProfile(profile);
  const response = await runSkill(
    DiscoveryLeads,
    "Search live for current direct employer vacancies matching these role queries; return at most ten distinct direct job URLs.",
    { queries: searchPlan.queries },
    profile.version,
    [],
    true,
    signal,
  );
  const seen = new Set<string>();
  const sources: SourceCapture[] = [];
  const limitations = [...response.result.limitations];
  if (!response.run.searchObserved)
    limitations.push(
      "The provider did not report a search event. Returned URLs were inspected separately; search coverage is unverified.",
    );
  const deadline = AbortSignal.timeout(120000);
  const inspectionSignal = signal
    ? AbortSignal.any([signal, deadline])
    : deadline;
  for (const lead of response.result.leads) {
    signal?.throwIfAborted();
    if (deadline.aborted) {
      limitations.push(
        "Source inspection reached its two-minute budget. Some returned leads remain uninspected; import their URLs individually to continue.",
      );
      break;
    }
    let source: SourceCapture;
    try {
      source = await captureSource(lead.url, inspectionSignal);
    } catch (error) {
      signal?.throwIfAborted();
      source = {
        id: randomUUID(),
        originalUrl: lead.url,
        finalUrl: lead.url,
        canonicalUrl: lead.url,
        retrievedAt: new Date().toISOString(),
        hash: "",
        text: "",
        status: "unverified",
        httpStatus: 0,
        limitations: [
          error instanceof Error
            ? error.message
            : "The returned source URL could not be inspected.",
        ],
      };
    }
    if (!seen.has(source.canonicalUrl)) {
      seen.add(source.canonicalUrl);
      sources.push(source);
    }
  }
  return { ...response, result: { ...response.result, limitations, sources } };
}
export async function assess(
  profile: WorkflowProfile,
  job: SourceCapture,
  signal?: AbortSignal,
) {
  validateProfile(profile);
  if (
    !profile.source.sourceHash ||
    !profile.source.sections.some((s) => s.text.trim())
  )
    throw new Error(
      "Import a readable CV before assessing or preparing this opportunity. You can still plan searches and inspect job URLs.",
    );
  verified(job);
  const response = await runValidatedSkill(
    Assessment,
    "Assess this exact advertised role against the source evidence. Use exactly these dimension identifiers: geography, authorization, work_mode, employment, language, pay, travel, overlap. Identify current job versus closed/generic page. Do not infer eligibility from residence or name.",
    { profile, job },
    profile.version,
    [profile.source.sourceHash, job.hash],
    false,
    signal,
    (response) => {
      if (
        !normalized(job.text).includes(normalized(response.result.title)) ||
        !response.result.title.trim()
      )
        throw new Error(
          "The assessed employer title is not present in the posting.",
        );
      if (
        response.result.requisitionId &&
        !hasRequisitionEvidence(job.text, response.result.requisitionId)
      )
        throw new Error(
          "A requisition identifier needs adjacent explicit requisition/req labeling in the supplied source. A posting URL number is not an employer requisition. Leave requisitionId empty when this evidence is absent.",
        );
      const required = [
        "geography",
        "authorization",
        "work_mode",
        "employment",
        "language",
        "pay",
        "travel",
        "overlap",
      ];
      if (
        required.some(
          (name) =>
            !response.result.dimensions.some((d) => d.dimension === name),
        ) ||
        new Set(response.result.dimensions.map((d) => d.dimension)).size !==
          response.result.dimensions.length
      )
        throw new Error(
          "Assessment omitted or duplicated a required eligibility dimension.",
        );
      for (const item of [
        ...response.result.dimensions,
        ...response.result.requirements,
      ]) {
        if (
          !item.evidence.length &&
          ("result" in item
            ? item.result !== "unknown"
            : item.support !== "not_evidenced")
        )
          throw new Error("An assessment conclusion lacks source evidence.");
        validateCitations(item.evidence, profile, job);
      }
      if (
        response.result.dimensions.some((d) => d.result === "incompatible") &&
        response.result.verdict !== "outside_constraints"
      )
        throw new Error("Assessment conflicts with an eligibility blocker.");
    },
  );
  return response;
}
export async function requirements(url: string, signal?: AbortSignal) {
  const source = await captureSource(url, signal);
  verified(source);
  const response = await runValidatedSkill(
    Requirements,
    "Extract only actual visible application fields from this static source. This is always partial static inspection. Do not infer form fields from a job description. Identify login/CAPTCHA/JavaScript/conditional-page limitations. All fields need exact source label citations.",
    { form: source },
    "",
    [source.hash],
    false,
    signal,
    (response) => {
      if (
        new Set(response.result.fields.map((field) => field.id)).size !==
        response.result.fields.length
      )
        throw new Error("Observed form fields must have unique identifiers.");
      for (const field of response.result.fields) {
        if (!field.id.trim() || !field.label.trim())
          throw new Error(
            "An observed form field needs a nonempty identifier and exact source label.",
          );
        if (!field.evidence.length)
          throw new Error("An observed form field lacks evidence.");
        validateCitations(field.evidence, undefined, undefined, source);
        if (!normalized(source.text).includes(normalized(field.label)))
          throw new Error("Form label is not present in the inspected source.");
      }
    },
  );
  const normalizedResponse = {
    ...response,
    result: {
      ...response.result,
      fields: response.result.fields.map((field) => {
        const observed = observedRequired(source.text, field);
        return observed === "unknown"
          ? field
          : { ...field, required: observed };
      }),
    },
  };
  if (inspectedRequirements.size >= 100)
    inspectedRequirements.delete(inspectedRequirements.keys().next().value!);
  inspectedRequirements.set(
    source.id,
    createHash("sha256")
      .update(JSON.stringify(normalizedResponse.result))
      .digest("hex"),
  );
  return { ...normalizedResponse, source };
}
export async function prepare(
  profile: WorkflowProfile,
  job: SourceCapture,
  form: SourceCapture,
  checklist: Requirements,
  signal?: AbortSignal,
) {
  validateProfile(profile);
  if (
    !profile.source.sourceHash ||
    !profile.source.sections.some((s) => s.text.trim())
  )
    throw new Error(
      "Import a readable CV before assessing or preparing this opportunity. You can still plan searches and inspect job URLs.",
    );
  verified(job);
  verified(form);
  if (
    inspectedRequirements.get(form.id) !==
    createHash("sha256").update(JSON.stringify(checklist)).digest("hex")
  )
    throw new Error(
      "Refresh application requirements: the checklist is not a verified result from this service session.",
    );
  const response = await runValidatedSkill(
    Preparation,
    "Prepare a local review package from these actual requirements. Evaluate every supplied CV section and return exact surgical edit proposals only. Faithful file editing is unavailable, so do not claim edited PDF/DOCX. Critical confirmations stay unanswered. Manual applicant-only writing stays blank. No prohibited AI-authored response. Cover letter only if actually requested. Application remains incomplete because inspection is partial.",
    { profile, job, form, requirements: checklist },
    profile.version,
    [profile.source.sourceHash, job.hash, form.hash],
    false,
    signal,
    (response) => {
      const result = response.result;
      for (const section of profile.source.sections)
        if (!result.sectionReview.some((r) => r.section === section.label))
          throw new Error("Preparation did not evaluate every CV section.");
      for (const edit of result.edits) {
        const original = profile.source.sections.find(
          (s) => s.label === edit.section,
        );
        if (
          !original ||
          !edit.before ||
          !original.text.includes(edit.before) ||
          !edit.evidence.length
        )
          throw new Error(
            "A proposed edit lacks an exact original span or evidence.",
          );
        validateCitations(edit.evidence, profile, job, form);
      }
      if (
        new Set(result.answers.map((answer) => answer.fieldId)).size !==
        result.answers.length
      )
        throw new Error(
          "Prepared answers must map uniquely to inspected questions.",
        );
      for (const answer of result.answers) {
        const field = checklist.fields.find((f) => f.id === answer.fieldId);
        if (!field || field.label !== answer.label)
          throw new Error(
            "A prepared answer does not match an inspected question.",
          );
        if (
          (field.responseKind === "critical_confirmation" ||
            field.responseKind === "manual_task") &&
          answer.text
        )
          throw new Error(
            "A critical or manual answer was filled without confirmation.",
          );
        if (
          field.responseKind === "critical_confirmation" &&
          answer.status !== "needs_confirmation"
        )
          throw new Error(
            "Critical answers must retain needs-confirmation status.",
          );
        if (
          field.responseKind === "manual_task" &&
          answer.status !== "manual_task"
        )
          throw new Error(
            "Applicant-only tasks must retain manual-task status.",
          );
        if (answer.text && !answer.evidence.length)
          throw new Error("A draft answer lacks evidence.");
        validateCitations(answer.evidence, profile, job, form);
      }
      if (
        result.coverLetter &&
        !checklist.attachments.some((a) => /cover.?letter/i.test(a)) &&
        !checklist.fields.some((a) => /cover.?letter/i.test(a.label))
      )
        throw new Error("An unrequested cover letter was generated.");
    },
  );
  const result = response.result;
  return {
    ...response,
    result: {
      ...result,
      confirmations: [
        ...new Set([
          ...result.confirmations,
          ...checklist.fields
            .filter(
              (field) =>
                (field.required === "required" ||
                  field.responseKind === "critical_confirmation") &&
                !result.answers.some(
                  (answer) => answer.fieldId === field.id && answer.text.trim(),
                ),
            )
            .map((field) => field.label),
        ]),
      ],
      qualityChecks: [
        "Source quotes and exact original edit spans validated by the service.",
        "Every supplied CV section evaluated; answers map to inspected questions.",
        ...result.qualityChecks.map(
          (check) => "Model review observation: " + check,
        ),
      ],
      limitations: [
        ...result.limitations,
        "Exact edit plan only: no source file was edited or visually validated. Static form inspection is partial; review is not approval or permission to transmit.",
      ],
    },
  };
}
export const profileFingerprint = (profile: WorkflowProfile) =>
  createHash("sha256").update(JSON.stringify(profile)).digest("hex");
