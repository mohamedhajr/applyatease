import { Button } from "@base-ui/react/button";
import { ArrowRight, FileText, HardDrive, Pencil } from "lucide-react";
import { useState } from "react";
import { downloadOriginal } from "./cv.ts";
import {
  countryStep,
  experienceStep,
  relevantCountries,
  employmentOptions,
  payFor,
  payUnits,
  levelStep,
  payStep,
  profileGaps,
  reviewIssue,
  type Step,
} from "./model.ts";
import { useProfile } from "./ProfileProvider.tsx";
import "./onboarding.css";

export function SaveStatus({ detailed = false }: { detailed?: boolean }) {
  const { status, error, retry } = useProfile();
  if (status === "error")
    return detailed ? (
      <div className="onb-storage-error" role="alert">
        <p>{error}</p>
        <Button className="onb-text" onClick={retry}>
          Retry local storage
        </Button>
        <p>Unsaved changes remain here while this page stays open.</p>
      </div>
    ) : (
      <span className="onb-save" role="status">
        Changes not saved
      </span>
    );
  return (
    <span className="onb-save" role="status">
      <HardDrive size={13} aria-hidden="true" />
      {status === "loading"
        ? "Opening your profile…"
        : status === "saving"
          ? "Saving on this device…"
          : "Saved on this device"}
    </span>
  );
}
const display = (value: string) => value.trim() || "Not set yet";
const yesNo = (value: string) =>
  value === "yes"
    ? "Yes"
    : value === "no"
      ? "No"
      : value === "unsure"
        ? "Not sure"
        : "Not confirmed";
export function ProfileReview({
  onEdit,
  onFinish,
}: {
  onEdit: (step: Step) => void;
  onFinish?: () => void;
}) {
  const { data, update, status } = useProfile();
  const [error, setError] = useState("");
  if (!data) return <SaveStatus detailed />;
  const p = data.profile;
  const rows: { title: string; step: Step; lines: string[] }[] = [
    {
      title: "Your starting point",
      step: "goal",
      lines: [
        p.goal === "find"
          ? "Find my next role"
          : p.goal === "explore"
            ? "See what’s out there"
            : p.goal === "change"
              ? "Make a career change"
              : "Goal not set",
      ],
    },
    {
      title: "Career source",
      step: "cv",
      lines: p.cv
        ? [
            p.cv.name,
            p.cv.reviewedAt
              ? `Text reviewed ${new Date(p.cv.reviewedAt).toLocaleDateString()}`
              : "Text extracted · review pending",
            ...(p.cv.notes ? [`Your notes: ${p.cv.notes}`] : []),
            p.analysis.message || "CV analysis not started",
          ]
        : ["No CV added · add one when you’re ready"],
    },
    {
      title: "Role tracks",
      step: "roles",
      lines: p.roles.length
        ? p.roles.map((r) => `${r.title} · ${r.level || "level open"}`)
        : ["No tracks selected"],
    },
    ...p.roles.map((role) => ({
      title: `Level · ${role.title}`,
      step: levelStep(role.title),
      lines: [display(role.level)],
    })),
    ...p.roles.map((role) => ({
      title: `Experience · ${role.title}`,
      step: experienceStep(role.title),
      lines: [display(role.experienceLevel)],
    })),
    {
      title: "Work modes",
      step: "work-modes",
      lines: [p.workModes.join(", ") || "Not set yet"],
    },
    ...(p.workModes.includes("remote")
      ? [
          {
            title: "Working country",
            step: "location" as const,
            lines: [display(p.country)],
          },
          {
            title: "Team overlap",
            step: "overlap" as const,
            lines: [display(p.overlap)],
          },
        ]
      : []),
    ...(p.workModes.some((m) => m !== "remote")
      ? [
          {
            title: "In-person destinations",
            step: "in-person" as const,
            lines: [p.inPersonCountries.join(", ") || "Not set yet"],
          },
        ]
      : []),
    { title: "Residence", step: "residence", lines: [display(p.residence)] },

    {
      title: "Work arrangement",
      step: "work",
      lines: [
        "English-language roles",
        ...p.employment.map(
          (v) => employmentOptions.find(([code]) => code === v)![1],
        ),
        ...(!p.employment.length ? ["Employment preference not set"] : []),
      ],
    },
    ...relevantCountries(p).map((country) => ({
      title: `Employment authorization · ${country}`,
      step: countryStep(country),
      lines: [
        p.countryAnswers[country]?.authorization === "unrestricted"
          ? "Authorized without restrictions"
          : p.countryAnswers[country]?.authorization === "yes"
            ? "Authorized with conditions or limits"
            : yesNo(p.countryAnswers[country]?.authorization ?? ""),
        `Sponsorship now: ${yesNo(p.countryAnswers[country]?.sponsorshipNow ?? "")}`,
        `Future sponsorship: ${yesNo(p.countryAnswers[country]?.sponsorshipLater ?? "")}`,
      ],
    })),
    {
      title: "Availability",
      step: "preferences",
      lines: [display(p.availability)],
    },
    { title: "Work travel", step: "travel", lines: [display(p.travel)] },
    {
      title: "Search exclusions",
      step: "exclusions",
      lines: [display(p.exclusions)],
    },
    ...(p.employment.length
      ? [
          {
            title: "Compensation preferences",
            step: "compensation" as const,
            lines: [
              p.payEnabled
                ? "Enabled · private search preferences"
                : "Left for later; saved drafts are not used",
            ],
          },
        ]
      : []),
    ...(p.payEnabled
      ? p.employment.flatMap((basis) => {
          const pay = payFor(p, basis);
          const label = employmentOptions.find(([code]) => code === basis)![1];
          return [
            {
              title: `${label} · currency`,
              step: payStep(basis, "currency"),
              lines: [display(pay.currency)],
            },
            {
              title: `${label} · period`,
              step: payStep(basis, "period"),
              lines: [pay.period ? `Per ${pay.period}` : "Not set yet"],
            },
            {
              title: `${label} · private minimum`,
              step: payStep(basis, "minimum"),
              lines: [
                pay.minimum
                  ? `${pay.minimum} ${pay.currency} / ${pay.period}${pay.confirmedUnits === payUnits(pay) ? "" : " · confirm units"}`
                  : "Not set yet",
              ],
            },
            {
              title: `${label} · target`,
              step: payStep(basis, "target"),
              lines: [
                pay.target
                  ? `${pay.target} ${pay.currency} / ${pay.period}`
                  : "Not set yet",
              ],
            },
          ];
        })
      : []),
    {
      title: "Additional evidence",
      step: "evidence",
      lines: [
        p.sampleChoice === "add"
          ? "Existing work sample selected"
          : "No additional sample selected",
      ],
    },
    ...(p.sampleChoice === "add"
      ? [
          {
            title: "Work-sample link",
            step: "sample-url" as const,
            lines: [
              p.sampleUrl,
              "Applicant-provided; link and ownership not verified",
            ],
          },
          {
            title: "Your contribution",
            step: "contribution" as const,
            lines: [display(p.contribution)],
          },
        ]
      : []),
    ...(p.cv
      ? [
          {
            title: "CV notes",
            step: "cv-notes" as const,
            lines: [p.cv.notes || "No corrections or notes added"],
          },
        ]
      : []),
  ];
  const gaps = profileGaps(p);
  return (
    <>
      <div className="onb-review-grid">
        {rows.map((row) => (
          <section className="onb-review-section" key={row.title}>
            <div>
              <h2>{row.title}</h2>
              <Button
                className="onb-edit"
                aria-label={`Edit ${row.title}`}
                onClick={() => onEdit(row.step)}
              >
                <Pencil size={13} /> Edit
              </Button>
            </div>
            {row.lines.map((line, n) => (
              <p key={n}>{line}</p>
            ))}
            {row.step === "cv" && p.cv && data.original && (
              <Button
                className="onb-text"
                onClick={() => downloadOriginal(data.original!, p.cv!.name)}
              >
                Save original file
              </Button>
            )}
          </section>
        ))}
      </div>
      {gaps.length > 0 && (
        <div className="onb-gaps">
          <strong>Still open — you can complete these later</strong>
          <ul>
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="onb-review-note">
        <FileText size={21} />
        <div>
          <strong>Your profile is a starting point.</strong>
          <p>
            Confirming it saves these preferences. Each exact application still
            needs your review and approval. Nothing here authorizes a
            submission.
          </p>
        </div>
      </div>
      {onFinish && (
        <>
          <p className="onb-hint">
            Job discovery is not available yet. After signing in, you can review
            your profile and explore the workspace. No search will run.
          </p>
          {error && (
            <p role="alert" className="onb-error">
              {error}
            </p>
          )}
          <div className="onb-actions">
            <Button
              className="onb-primary"
              disabled={status !== "saved"}
              onClick={() => {
                const issue = reviewIssue(p);
                if (issue) {
                  setError(issue.message);
                  onEdit(issue.step);
                  return;
                }
                update(
                  {
                    confirmedAt: new Date().toISOString(),
                    setupCompletedAt:
                      p.setupCompletedAt || new Date().toISOString(),
                    step: "review",
                  },
                  undefined,
                  true,
                );
                onFinish();
              }}
            >
              Confirm search profile <ArrowRight size={17} />
            </Button>
          </div>
        </>
      )}
    </>
  );
}
