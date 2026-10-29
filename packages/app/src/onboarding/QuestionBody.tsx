import { Button } from "@base-ui/react/button";
import { FileText, Globe2 } from "lucide-react";
import type { ReactNode } from "react";
import { Choice, Field } from "./controls.tsx";
import { CvImport } from "./CvImport.tsx";
import { downloadOriginal } from "./cv.ts";
import {
  creativeProfile,
  payForStep,
  roleForStep,
  suggestedRoles,
  type Step,
} from "./model.ts";
import { CvInsights } from "./CvInsights.tsx";
import {
  newRole,
  experienceStep,
  countryForStep,
  blankCountryAnswer,
  payFor,
  employmentOptions,
  effectiveFact,
  effectiveAnalysis,
} from "./model.ts";
import { useProfile } from "./ProfileProvider.tsx";
import { SearchAnswer, suggest } from "./SearchAnswer.tsx";
import { SalaryAmount } from "./SalaryAmount.tsx";
import cvCare from "./assets/cv-care.png";
import paths from "./assets/paths.png";
import studio from "./assets/studio.png";

const countrySuggestions = suggest([
  "Egypt",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "India",
  "Singapore",
  "Australia",
]);
const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const currencyCodes = Intl.supportedValuesOf("currency");
const currencies = [
  ...new Set(["USD", "EUR", "GBP", "AED", "EGP", "CAD", ...currencyCodes]),
].map((value) => ({
  value,
  label: `${value} · ${currencyNames.of(value) ?? value}`,
}));
const levels = [
  "Entry level",
  "Mid level",
  "Senior",
  "Lead / staff",
  "Manager",
  "Open to discussion",
];
function Options<T extends string>({
  name,
  selected,
  choices,
  onChange,
}: {
  name: string;
  selected: string;
  choices: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="onb-options"
      role="radiogroup"
      aria-labelledby="onboarding-question"
    >
      {choices.map((value) => (
        <Choice
          key={value}
          name={name}
          value={value}
          selected={selected === value}
          onChange={onChange}
          title={value}
        />
      ))}
    </div>
  );
}
function Interlude({
  image,
  caption,
  children,
}: {
  image: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="onb-interlude">
      <img src={image} alt="" width={1536} height={1024} />
      <p className="onb-illustration-caption">{caption}</p>
      <div>{children}</div>
    </div>
  );
}
export function QuestionBody({
  step,
  busy,
  onBusy,
  onError,
  onPending,
}: {
  step: Step;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onPending: (pending: boolean) => void;
}) {
  const { data, update } = useProfile();
  if (!data) return null;
  const p = data.profile;
  const analysis = effectiveAnalysis(p);
  const role = roleForStep(step, p);
  const experienceRole = p.roles.find((r) => experienceStep(r.title) === step);
  const country = countryForStep(step, p);
  if (country) {
    const answer = p.countryAnswers[country] ?? blankCountryAnswer();
    const key = step.startsWith("country:")
      ? "authorization"
      : step.startsWith("sponsor:")
        ? "sponsorshipNow"
        : "sponsorshipLater";
    const choices =
      key === "authorization"
        ? ([
            ["unrestricted", "Authorized without restrictions"],
            ["yes", "Authorized with conditions or limits"],
            ["no", "Not currently authorized"],
            ["unsure", "Not sure yet"],
          ] as const)
        : ([
            ["yes", "Yes"],
            ["no", "No"],
            ["unsure", "Not sure yet"],
          ] as const);
    return (
      <div
        className="onb-options"
        role="radiogroup"
        aria-labelledby="onboarding-question"
      >
        {choices.map(([value, title]) => (
          <Choice
            key={value}
            name="country-answer"
            value={value}
            title={title}
            selected={answer[key] === value}
            onChange={(value) =>
              update({
                countryAnswers: {
                  ...p.countryAnswers,
                  [country]: {
                    ...answer,
                    [key]: value,
                    confirmedAt: new Date().toISOString(),
                  },
                },
              })
            }
          />
        ))}
      </div>
    );
  }
  if (experienceRole) {
    const suggestion = analysis?.roles.find(
      (r) => r.title.toLowerCase() === experienceRole.title.toLowerCase(),
    );
    return (
      <>
        {suggestion && (
          <p className="onb-note">
            Your CV suggests{" "}
            {suggestion.experienceLevel || "a level needing clarification"}.{" "}
            {suggestion.uncertainty} This is a proposal for this direction, not
            a verified qualification.
          </p>
        )}
        <Options
          name="experience"
          selected={experienceRole.experienceLevel}
          choices={["New to this role", ...levels, "Not sure yet"]}
          onChange={(experienceLevel) =>
            update({
              roles: p.roles.map((r) =>
                r.title === experienceRole.title
                  ? {
                      ...r,
                      experienceLevel,
                      experienceConfirmedAt: new Date().toISOString(),
                    }
                  : r,
              ),
            })
          }
        />
      </>
    );
  }
  if (role)
    return (
      <Options
        name="level"
        selected={role.level}
        choices={levels}
        onChange={(level) =>
          update({
            roles: p.roles.map((r) =>
              r.title === role.title ? { ...r, level } : r,
            ),
          })
        }
      />
    );
  const salary = payForStep(step);
  if (salary) {
    const pay = payFor(p, salary.basis);
    const set = (patch: Partial<typeof pay>) =>
      update({
        payByEmployment: {
          ...p.payByEmployment,
          [salary.basis]: { ...pay, ...patch },
        },
      });
    if (salary.question === "currency")
      return (
        <>
          <SearchAnswer
            label="Currency"
            placeholder="Search a currency or code"
            selected={pay.currency ? [pay.currency] : []}
            options={currencies}
            allowCustom={false}
            onSelect={(currency) => set({ currency })}
            onRemove={() => set({ currency: "" })}
            onPending={onPending}
          />
          <p className="onb-note">
            Changing currency keeps your entered amounts. It does not convert
            them. Review the minimum and target in the following questions.
          </p>
        </>
      );
    if (salary.question === "period")
      return (
        <>
          <div
            className="onb-options"
            role="radiogroup"
            aria-labelledby="onboarding-question"
          >
            {(
              [
                ["year", "Per year"],
                ["month", "Per month"],
                ["hour", "Per hour"],
              ] as const
            ).map(([value, title]) => (
              <Choice
                key={value}
                name="period"
                value={value}
                title={title}
                selected={pay.period === value}
                onChange={(period) => set({ period })}
              />
            ))}
          </div>
          <p className="onb-note">
            Amounts stay unchanged when you change the period. Review them next;
            no conversion is applied.
          </p>
        </>
      );
    return (
      <>
        <SalaryAmount
          kind={salary.question}
          currency={pay.currency}
          period={pay.period}
          value={pay[salary.question]}
          onChange={(value) => set({ [salary.question]: value })}
        />
        <p className="onb-note">
          <LockNote />
          {salary.question === "minimum"
            ? "Only a private search boundary. This amount is never an automatic answer to an employer."
            : "A preference to aim for. An employer’s requested salary answer remains yours to review."}
        </p>
      </>
    );
  }
  switch (step) {
    case "cv-analysis":
      return <CvInsights />;
    case "goal":
      return (
        <>
          <div
            className="onb-options"
            role="radiogroup"
            aria-labelledby="onboarding-question"
          >
            {(
              [
                [
                  "find",
                  "Find my next role",
                  "Focus on opportunities that fit my experience.",
                ],
                [
                  "explore",
                  "See what’s out there",
                  "Get clear on my options, without rushing.",
                ],
                [
                  "change",
                  "Make a career change",
                  "Explore a new direction with the experience I have.",
                ],
              ] as const
            ).map(([value, title, detail]) => (
              <Choice
                key={value}
                name="goal"
                value={value}
                selected={p.goal === value}
                onChange={(goal) => update({ goal })}
                title={title}
                detail={detail}
              />
            ))}
          </div>
          <p className="onb-note">
            <Globe2 size={16} />
            Built around English remote roles and long-term work.
          </p>
        </>
      );
    case "cv":
      return <CvImport busy={busy} onBusy={onBusy} onError={onError} />;
    case "cv-review":
      return (
        p.cv && (
          <>
            <div className="onb-file-row">
              <FileText size={22} />
              <div>
                <strong>{p.cv.name}</strong>
                <small>
                  {p.cv.format === "pdf"
                    ? `${p.cv.sections.length} pages extracted`
                    : "Document text extracted"}{" "}
                  · needs your review
                </small>
              </div>
              <Button
                type="button"
                className="onb-text"
                onClick={() =>
                  data.original && downloadOriginal(data.original, p.cv!.name)
                }
              >
                Save original
              </Button>
            </div>
            <div
              className="onb-source-text"
              tabIndex={0}
              aria-label="Extracted CV text"
            >
              {p.cv.sections.map((section) => (
                <section key={section.label}>
                  <h2>{section.label}</h2>
                  <p>{section.text || "No readable text on this page."}</p>
                </section>
              ))}
            </div>
            {p.cv.warnings.map((warning) => (
              <p className="onb-warning" key={warning}>
                {warning}
              </p>
            ))}
            <p className="onb-hint">
              Text order can differ in columns. This is source text, not a
              verified career profile. CV analysis is available separately;
              tailoring is not connected. Add corrections in your profile.
            </p>
            <label className="onb-check">
              <input
                type="checkbox"
                checked={!!p.cv.reviewedAt}
                onChange={(e) =>
                  update({
                    cv: {
                      ...p.cv!,
                      reviewedAt: e.target.checked
                        ? new Date().toISOString()
                        : "",
                    },
                  })
                }
              />
              <span>
                I’ve checked this text against my CV. Keep it as my career
                source.
              </span>
            </label>
          </>
        )
      );
    case "cv-notes":
      return (
        p.cv && (
          <Field label="CV notes (optional)">
            <textarea
              rows={5}
              maxLength={4000}
              value={p.cv.notes}
              placeholder="A correction or a little context…"
              onChange={(e) =>
                update({ cv: { ...p.cv!, notes: e.target.value } })
              }
            />
          </Field>
        )
      );
    case "cv-story":
      return (
        <Interlude
          image={cvCare}
          caption="A thoughtful edit starts with the original."
        >
          <p>
            When tailoring is connected, it should review every section and make
            justified edits to a copy. Your layout, effective wording and
            original file stay intact.
          </p>
          <div className="onb-promise">
            <FileText size={18} />
            <span>Original preserved. Changes yours to review.</span>
          </div>
        </Interlude>
      );
    case "roles":
      return (
        <>
          <SearchAnswer
            label="Role titles"
            placeholder="Search or add a role title"
            selected={p.roles.map((r) => r.title)}
            options={suggest([
              ...new Set([
                ...(analysis?.roles.map((r) => r.title) ?? []),
                ...suggestedRoles,
              ]),
            ])}
            multiple
            onSelect={(title) => {
              if (
                !p.roles.some(
                  (r) => r.title.toLowerCase() === title.toLowerCase(),
                )
              )
                update({ roles: [...p.roles, newRole(title)] });
            }}
            onRemove={(title) =>
              update({ roles: p.roles.filter((r) => r.title !== title) })
            }
            onPending={onPending}
          />
          <p className="onb-note">
            Each title stays a separate search track. These are directions you
            choose, not inferred qualifications. FDE means Forward Deployed
            Engineer.
          </p>
        </>
      );
    case "direction":
      return (
        <Interlude
          image={creativeProfile(p) ? studio : paths}
          caption={
            creativeProfile(p)
              ? "The work. The context. Your contribution."
              : "Different paths can share the same starting point."
          }
        >
          <p>
            {creativeProfile(p)
              ? "Your samples can show what you made and the part you played. Later, add an existing link if it helps tell that story."
              : p.goal === "change"
                ? "A new direction starts with the experience you actually have. Adjacent roles are possibilities to explore, never qualifications to assume."
                : "Your experience can support more than one direction. Each selected role stays its own track, with the level you choose."}
          </p>
          <div className="onb-track-tags">
            {p.roles.map((r) => (
              <span key={r.title}>{r.title}</span>
            ))}
          </div>
        </Interlude>
      );
    case "location":
      return (
        <>
          <SearchAnswer
            label="Physical remote-work country"
            placeholder="Search or add a country"
            selected={p.country ? [p.country] : []}
            options={countrySuggestions}
            onSelect={(country) => update({ country })}
            onRemove={() => update({ country: "" })}
            onPending={onPending}
          />
          <p className="onb-note">
            <Globe2 size={16} />
            Location alone doesn’t establish work authorization.
          </p>
        </>
      );
    case "residence": {
      const facts =
        p.analysis.result?.facts.filter(
          (f) => f.kind === "residence" && !f.uncertainty,
        ) ?? [];
      const fact = facts.length === 1 ? facts[0] : undefined;
      const proposed = fact ? effectiveFact(p, fact) : null;
      return (
        <>
          {fact && proposed?.status !== "candidate_denied" && (
            <div className="onb-note">
              <div>
                <p>
                  Your CV lists {proposed?.value}. Is this where you’re
                  currently based?
                </p>
                <Button
                  type="button"
                  className="onb-text"
                  onClick={() =>
                    update({
                      residence: proposed!.value,
                      corrections: [
                        ...p.corrections,
                        {
                          factId: fact.id,
                          sourceHash: p.analysis.sourceHash,
                          value: proposed!.value,
                          status: "candidate_confirmed",
                          confirmedAt: new Date().toISOString(),
                        },
                      ],
                    })
                  }
                >
                  Yes, use this location
                </Button>
                <p className="onb-hint">
                  Or change it below. A location does not establish work
                  authorization.
                </p>
              </div>
            </div>
          )}
          <SearchAnswer
            label="Current residence"
            placeholder="Search or add your city and country"
            selected={p.residence ? [p.residence] : []}
            options={countrySuggestions}
            onSelect={(residence) => update({ residence })}
            onRemove={() => update({ residence: "" })}
            onPending={onPending}
          />
        </>
      );
    }
    case "work-modes":
      return (
        <div
          className="onb-options"
          role="group"
          aria-labelledby="onboarding-question"
        >
          {(["remote", "hybrid", "on-site"] as const).map((value) => (
            <Choice
              key={value}
              name="work-mode"
              multiple
              value={value}
              title={
                value === "remote"
                  ? "Remote"
                  : value === "hybrid"
                    ? "Hybrid"
                    : "On-site"
              }
              selected={p.workModes.includes(value)}
              onChange={(mode) =>
                update({
                  workModes: p.workModes.includes(mode)
                    ? p.workModes.filter((m) => m !== mode)
                    : [...p.workModes, mode],
                })
              }
            />
          ))}
        </div>
      );
    case "in-person":
      return (
        <SearchAnswer
          label="In-person work countries"
          placeholder="Search or add a country you could work in"
          multiple
          selected={p.inPersonCountries}
          options={countrySuggestions}
          onSelect={(country) =>
            update({
              inPersonCountries: [
                ...new Set([...p.inPersonCountries, country]),
              ],
            })
          }
          onRemove={(country) =>
            update({
              inPersonCountries: p.inPersonCountries.filter(
                (c) => c !== country,
              ),
            })
          }
          onPending={onPending}
        />
      );
    case "overlap":
      return (
        <Field label="Preferred overlap hours (optional)">
          <input
            maxLength={300}
            value={p.overlap}
            onChange={(e) => update({ overlap: e.target.value })}
            placeholder="Hours and time zone that work for you"
          />
        </Field>
      );
    case "work":
      return (
        <>
          <div
            className="onb-options"
            role="group"
            aria-labelledby="onboarding-question"
          >
            {employmentOptions.map(([value, title]) => (
              <Choice
                key={value}
                name="employment"
                multiple
                value={value}
                title={title}
                selected={p.employment.includes(value)}
                onChange={(v) =>
                  update({
                    employment: p.employment.includes(v)
                      ? p.employment.filter((item) => item !== v)
                      : [...p.employment, v],
                  })
                }
              />
            ))}
          </div>
          <p className="onb-hint">
            These are your preferences. Search and application support for each
            arrangement will be checked when those features are connected.
          </p>
        </>
      );
    case "eligibility":
    case "sponsorship-now":
    case "sponsorship-later": {
      const key =
        step === "eligibility"
          ? "authorization"
          : step === "sponsorship-now"
            ? "sponsorshipNow"
            : "sponsorshipLater";
      return (
        <div
          className="onb-options"
          role="radiogroup"
          aria-labelledby="onboarding-question"
        >
          {(
            [
              ["yes", "Yes"],
              ["no", "No"],
              ["unsure", "Not sure yet"],
            ] as const
          ).map(([value, title]) => (
            <Choice
              key={value}
              name={key}
              value={value}
              title={title}
              selected={p[key] === value}
              onChange={(v) => update({ [key]: v })}
            />
          ))}
        </div>
      );
    }
    case "preferences":
      return (
        <Options
          name="availability"
          selected={p.availability}
          choices={[
            "Immediately",
            "Within a month",
            "Within three months",
            "After my notice period",
            "Flexible / discuss per role",
          ]}
          onChange={(availability) => update({ availability })}
        />
      );
    case "travel":
      return (
        <Options
          name="travel"
          selected={p.travel}
          choices={[
            "No work travel",
            "Occasional travel",
            "Open to regular travel",
            "Discuss per role",
          ]}
          onChange={(travel) => update({ travel })}
        />
      );
    case "exclusions":
      return (
        <Field label="Search exclusions (optional)">
          <textarea
            rows={5}
            maxLength={4000}
            value={p.exclusions}
            onChange={(e) => update({ exclusions: e.target.value })}
            placeholder="Your boundaries, in a few words…"
          />
        </Field>
      );
    case "compensation":
      return (
        <div
          className="onb-options"
          role="radiogroup"
          aria-labelledby="onboarding-question"
        >
          <Choice
            name="pay"
            value="now"
            selected={p.payEnabled}
            onChange={() => update({ payEnabled: true })}
            title="Set my pay preferences"
            detail="Choose a currency, period, private minimum and target."
          />
          <Choice
            name="pay"
            value="later"
            selected={!p.payEnabled && p.visited.includes("compensation")}
            onChange={() =>
              update({
                payEnabled: false,
                visited: [...new Set([...p.visited, "compensation" as const])],
              })
            }
            title="Leave pay preferences for later"
            detail="Discuss compensation when there’s a real opportunity."
          />
        </div>
      );
    case "evidence":
      return (
        <>
          <div
            className="onb-options"
            role="radiogroup"
            aria-labelledby="onboarding-question"
          >
            <Choice
              name="sample"
              value="add"
              selected={p.sampleChoice === "add"}
              onChange={(sampleChoice) => update({ sampleChoice })}
              title={
                creativeProfile(p)
                  ? "Add an existing portfolio or work sample"
                  : "Add an existing project or work sample"
              }
              detail="A link and a little context about your contribution."
            />
            <Choice
              name="sample"
              value="later"
              selected={p.sampleChoice === "later"}
              onChange={(sampleChoice) => update({ sampleChoice })}
              title={
                p.cv?.reviewedAt ? "Start with my CV" : "Leave this for later"
              }
              detail="Add evidence when a specific role needs it."
            />
          </div>
          <p className="onb-note">
            <FileText size={16} />
            No cover letter to write here. Drafted wording belongs in each
            application’s review, once writing is connected.
          </p>
        </>
      );
    case "sample-url":
      return (
        <Field label="Portfolio or work-sample URL">
          <input
            type="url"
            maxLength={2000}
            placeholder="https://"
            value={p.sampleUrl}
            onChange={(e) => update({ sampleUrl: e.target.value })}
          />
        </Field>
      );
    case "contribution":
      return (
        <Field label="Your contribution">
          <textarea
            rows={5}
            maxLength={4000}
            value={p.contribution}
            onChange={(e) => update({ contribution: e.target.value })}
          />
        </Field>
      );
    default:
      return null;
  }
}
function LockNote() {
  return <FileText size={16} aria-hidden="true" />;
}
