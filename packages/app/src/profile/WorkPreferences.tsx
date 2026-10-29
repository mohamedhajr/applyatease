import { Button } from "@base-ui/react/button";
import {
  countryStep,
  payStep,
  payUnits,
  relevantCountries,
  stepsFor,
  type Profile,
  type Step,
} from "../onboarding/model.ts";
import { employmentLabels, workModeLabels } from "./completion.ts";
import { DetailRow, ProfileSection } from "./ProfileSection.tsx";

const answerLabel = (value: string | undefined) =>
  value === "unrestricted"
    ? "Authorized without restrictions"
    : value === "yes"
      ? "Yes"
      : value === "no"
        ? "No"
        : value === "unsure"
          ? "Not sure"
          : "Not provided";
const valueOrOpen = (value: string) => value.trim() || "Not provided";
interface WorkPreferencesProps {
  profile: Profile;
  onEdit: (step: Step) => void;
}
export function WorkPreferences({ profile: p, onEdit }: WorkPreferencesProps) {
  const countries = relevantCountries(p);
  const activeSteps = stepsFor(p);
  return (
    <>
      <ProfileSection
        id="work-preferences"
        title="Work & location"
        description="Your choices are saved here. Availability of job-search modes will be shown when search is connected."
      >
        <dl className="candidate-detail-rows">
          <DetailRow label="Work modes" onEdit={() => onEdit("work-modes")}>
            {p.workModes.length
              ? p.workModes.map((mode) => workModeLabels[mode]).join(" · ")
              : "Not provided"}
          </DetailRow>
          <DetailRow label="Employment" onEdit={() => onEdit("work")}>
            {p.employment.length
              ? p.employment.map((basis) => employmentLabels[basis]).join(" · ")
              : "Not provided"}
          </DetailRow>
          <DetailRow label="Currently based" onEdit={() => onEdit("residence")}>
            {valueOrOpen(p.residence)}
          </DetailRow>
          {p.workModes.includes("remote") && (
            <>
              <DetailRow
                label="Remote work country"
                onEdit={() => onEdit("location")}
              >
                {valueOrOpen(p.country)}
              </DetailRow>
              <DetailRow label="Team overlap" onEdit={() => onEdit("overlap")}>
                {valueOrOpen(p.overlap)}
              </DetailRow>
            </>
          )}
          {p.workModes.some(
            (mode) => mode === "hybrid" || mode === "on-site",
          ) && (
            <DetailRow
              label="In-person locations"
              onEdit={() => onEdit("in-person")}
            >
              {p.inPersonCountries.join(" · ") || "Not provided"}
            </DetailRow>
          )}
        </dl>
        {countries.length > 0 && (
          <details className="candidate-disclosure">
            <summary>
              Work authorization · {countries.length}{" "}
              {countries.length === 1 ? "country" : "countries"}
            </summary>
            <p className="candidate-muted">
              Your answers apply to these physical work countries. Residence
              does not establish authorization.
            </p>
            {countries.map((country) => {
              const answer = p.countryAnswers[country];
              return (
                <article className="candidate-evidence-item" key={country}>
                  <h3>{country}</h3>
                  <dl className="candidate-detail-rows">
                    <DetailRow
                      label="Current authorization"
                      onEdit={() => onEdit(countryStep(country))}
                    >
                      {answer?.authorization === "yes"
                        ? "Authorized with conditions or limits"
                        : answerLabel(answer?.authorization)}
                    </DetailRow>
                    {(activeSteps.includes(
                      `sponsor:${encodeURIComponent(country)}`,
                    ) ||
                      answer?.sponsorshipNow) && (
                      <DetailRow
                        label="Sponsorship now"
                        onEdit={() =>
                          onEdit(`sponsor:${encodeURIComponent(country)}`)
                        }
                      >
                        {answerLabel(answer?.sponsorshipNow)}
                      </DetailRow>
                    )}
                    {(activeSteps.includes(
                      `future:${encodeURIComponent(country)}`,
                    ) ||
                      answer?.sponsorshipLater) && (
                      <DetailRow
                        label="Future sponsorship"
                        onEdit={() =>
                          onEdit(`future:${encodeURIComponent(country)}`)
                        }
                      >
                        {answerLabel(answer?.sponsorshipLater)}
                      </DetailRow>
                    )}
                  </dl>
                  {!answer?.sponsorshipNow &&
                    !activeSteps.includes(
                      `sponsor:${encodeURIComponent(country)}`,
                    ) && (
                      <p className="candidate-footnote">
                        No sponsorship declaration recorded. This authorization
                        answer does not supply one.
                      </p>
                    )}
                  {answer?.confirmedAt && (
                    <p className="candidate-footnote">
                      Your statement · last updated{" "}
                      {new Date(answer.confirmedAt).toLocaleDateString()}. Exact
                      employer declarations remain for review.
                    </p>
                  )}
                </article>
              );
            })}
          </details>
        )}
      </ProfileSection>
      <ProfileSection
        id="pay"
        title="Compensation & availability"
        description="Private preferences. A later application’s salary answer needs its own review."
      >
        <dl className="candidate-detail-rows">
          <DetailRow label="Availability" onEdit={() => onEdit("preferences")}>
            {valueOrOpen(p.availability)}
          </DetailRow>
          {p.employment.length > 0 && (
            <DetailRow
              label="Pay preferences"
              onEdit={() => onEdit("compensation")}
            >
              {p.payEnabled
                ? "Enabled"
                : p.skipped.includes("compensation") ||
                    p.confirmations.compensation
                  ? "Left for later"
                  : "Not provided"}
            </DetailRow>
          )}
        </dl>
        {p.payEnabled &&
          p.employment.map((basis) => {
            const pay = p.payByEmployment[basis];
            const units =
              pay?.currency && pay.period
                ? `${pay.currency} / ${pay.period}`
                : "Units not set";
            return (
              <article key={basis} className="candidate-evidence-item">
                <h3>{employmentLabels[basis]}</h3>
                <p className="candidate-footnote">
                  {basis === "contract" || basis === "short-contract"
                    ? "Contract fees · before tax and expenses"
                    : "Employee pay · gross"}
                </p>
                <dl className="candidate-detail-rows">
                  <DetailRow
                    label="Currency"
                    onEdit={() => onEdit(payStep(basis, "currency"))}
                  >
                    {pay?.currency || "Not provided"}
                  </DetailRow>
                  <DetailRow
                    label="Period"
                    onEdit={() => onEdit(payStep(basis, "period"))}
                  >
                    {pay?.period ? `Per ${pay.period}` : "Not provided"}
                  </DetailRow>
                  <DetailRow
                    label="Private minimum"
                    onEdit={() => onEdit(payStep(basis, "minimum"))}
                  >
                    {pay?.minimum
                      ? `${pay.minimum} · ${units}`
                      : "Not provided"}
                  </DetailRow>
                  <DetailRow
                    label="Optional target"
                    onEdit={() => onEdit(payStep(basis, "target"))}
                  >
                    {pay?.target ? `${pay.target} · ${units}` : "Not provided"}
                  </DetailRow>
                </dl>
                {pay &&
                  (pay.minimum || pay.target) &&
                  pay.confirmedUnits !== payUnits(pay) && (
                    <p className="candidate-footnote">
                      Amounts retained as drafts. Confirm them in the selected
                      currency and period before using them.
                    </p>
                  )}
              </article>
            );
          })}
      </ProfileSection>
      <ProfileSection id="other-preferences" title="Other details">
        <dl className="candidate-detail-rows">
          <DetailRow label="Work travel" onEdit={() => onEdit("travel")}>
            {valueOrOpen(p.travel)}
          </DetailRow>
          <DetailRow
            label="Search exclusions"
            onEdit={() => onEdit("exclusions")}
          >
            {valueOrOpen(p.exclusions)}
          </DetailRow>
          <DetailRow
            label="Additional work sample"
            onEdit={() => onEdit("evidence")}
          >
            {p.sampleChoice === "add"
              ? "Selected"
              : p.sampleChoice === "later"
                ? "Left for later"
                : "Not provided"}
          </DetailRow>
          {p.sampleChoice === "add" && (
            <>
              <DetailRow
                label="Sample link"
                onEdit={() => onEdit("sample-url")}
              >
                {valueOrOpen(p.sampleUrl)}
              </DetailRow>
              <DetailRow
                label="Your contribution"
                onEdit={() => onEdit("contribution")}
              >
                {valueOrOpen(p.contribution)}
              </DetailRow>
            </>
          )}
        </dl>
        {p.sampleChoice === "add" && (
          <p className="candidate-footnote">
            Applicant-provided link and contribution. Ownership and contents are
            not independently verified.
          </p>
        )}
        <div className="candidate-actions">
          <Button className="candidate-link" onClick={() => onEdit("goal")}>
            Edit career goal
          </Button>
        </div>
      </ProfileSection>
    </>
  );
}
