import { Button } from "@base-ui/react/button";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FileText,
  HardDrive,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { downloadOriginal } from "./cv.ts";
import {
  emptyProfile,
  levelStep,
  payStep,
  profileGaps,
  reviewIssue,
  type Step,
} from "./model.ts";
import { useProfile } from "./ProfileProvider.tsx";
import notices from "./THIRD_PARTY_NOTICES.txt?url";
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
            "Structured career analysis pending",
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
    { title: "Working country", step: "location", lines: [display(p.country)] },
    { title: "Residence", step: "residence", lines: [display(p.residence)] },
    { title: "Time zone", step: "timezone", lines: [display(p.timezone)] },
    { title: "Team overlap", step: "overlap", lines: [display(p.overlap)] },
    {
      title: "Work arrangement",
      step: "work",
      lines: [
        "Remote · English-language roles",
        ...p.employment.map((v) =>
          v === "full-time" ? "Full-time employment" : "Long-term contract",
        ),
        ...(!p.employment.length ? ["Employment preference not set"] : []),
      ],
    },
    ...(p.employment.includes("full-time") && p.country
      ? [
          {
            title: `Employment authorization · ${p.country}`,
            step: "eligibility" as const,
            lines: [
              yesNo(p.authorization),
              "Country-scoped statement; exact employer declarations still need review",
            ],
          },
          {
            title: `Sponsorship now · ${p.country}`,
            step: "sponsorship-now" as const,
            lines: [yesNo(p.sponsorshipNow)],
          },
          {
            title: `Future sponsorship · ${p.country}`,
            step: "sponsorship-later" as const,
            lines: [yesNo(p.sponsorshipLater)],
          },
        ]
      : []),
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
          const pay = basis === "full-time" ? p.fullTimePay : p.contractPay;
          const label =
            basis === "full-time"
              ? "Employment (gross)"
              : "Contract (before tax)";
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
                  ? `${pay.minimum} ${pay.currency} / ${pay.period}`
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
            Job discovery and assistant connection aren’t available yet. After
            signing in, you can review your profile and explore the workspace.
            No search will run.
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
                  { confirmedAt: new Date().toISOString(), step: "review" },
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
export function ProfilePage() {
  const { data, update, status } = useProfile();
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const edit = (step: Step) => {
    update(
      {
        step,
        visited: [
          ...new Set([...(data?.profile.visited ?? []), "review" as const]),
        ],
      },
      undefined,
      true,
    );
    void navigate({ to: "/onboarding" });
  };
  const p = data?.profile;
  return (
    <section className="page-panel">
      <header className="panel-header">
        <h1>Your profile</h1>
        <SaveStatus />
      </header>
      <div className="profile-page">
        {!p ? (
          <SaveStatus detailed />
        ) : (
          <>
            <div className="onb-profile-heading">
              <p className="onb-eyebrow">Your search, on your terms</p>
              <h2>
                {p.confirmedAt
                  ? "A little clarity for your next move."
                  : "Your next chapter starts here."}
              </h2>
              <p>
                {p.confirmedAt
                  ? "Your search preferences are saved. Revisit any part as your plans change."
                  : "Set up your search profile. Your progress stays here between visits."}
              </p>
            </div>
            {!p.confirmedAt && (
              <Button className="onb-primary" onClick={() => edit(p.step)}>
                {p.updatedAt ? "Resume setup" : "Set up your profile"}
                <ArrowRight size={17} />
              </Button>
            )}
            {p.confirmedAt && (
              <div className="onb-next-step">
                <span className="onb-done">
                  <Check size={18} />
                </span>
                <div>
                  <strong>
                    {status === "saved"
                      ? "Search profile saved locally"
                      : "Saving your search profile"}
                  </strong>
                  <p>
                    Discovery is not connected yet, so there’s no shortlist to
                    show. Your profile is ready to revisit; no employer has
                    received your information.
                  </p>
                  <Link to="/" className="onb-text">
                    Open your workspace <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )}
            {(p.updatedAt || p.confirmedAt) && <ProfileReview onEdit={edit} />}
            {status === "error" && <SaveStatus detailed />}
            <div className="onb-local-note">
              <HardDrive size={17} />
              <p>
                Stored only in this browser or desktop app on this device. Not
                synced to other devices. Clearing app or browser data removes
                it. Your CV and answers are not sent to a server.
              </p>
            </div>
            <a
              className="onb-text"
              href={notices}
              download="cv-reader-notices.txt"
            >
              CV reader license notices
            </a>
            <div className="onb-delete">
              {deleting ? (
                <>
                  <p>
                    Remove this local profile and its stored CV? Your source
                    file outside the app won’t be changed.
                  </p>
                  <Button
                    className="onb-text"
                    onClick={() => {
                      update(emptyProfile(), null, true);
                      setDeleting(false);
                    }}
                  >
                    Remove local profile
                  </Button>
                  <Button
                    className="onb-text"
                    onClick={() => setDeleting(false)}
                  >
                    Keep profile
                  </Button>
                </>
              ) : (
                <Button className="onb-text" onClick={() => setDeleting(true)}>
                  <RotateCcw size={13} /> Clear local profile
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
