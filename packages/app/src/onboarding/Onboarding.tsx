import { Button } from "@base-ui/react/button";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Sprout,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { payForStep, stepsFor, validationFor, type Step } from "./model.ts";
import { useProfile } from "./ProfileProvider.tsx";
import { ProfileReview, SaveStatus } from "./ProfileReview.tsx";
import { QuestionBody } from "./QuestionBody.tsx";
import { phases, questionFor } from "./questions.ts";
import "./onboarding.css";

export function Onboarding() {
  const { data, update, status } = useProfile();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const p = data?.profile;
  const steps = p ? stepsFor(p) : [];
  const fallback: Step = p?.step.startsWith("level:")
    ? "roles"
    : p?.step.startsWith("pay:")
      ? "work"
      : "goal";
  const step = p && steps.includes(p.step) ? p.step : fallback;
  const index = steps.indexOf(step);
  const question = p
    ? questionFor(step, p)
    : { title: "", detail: "", phase: 0 };
  const interlude = step === "cv-story" || step === "direction";
  const salary = payForStep(step);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const go = (next: Step) => {
    if (!p) return;
    setError("");
    setPending(false);
    update(
      { step: next, visited: [...new Set([...p.visited, step])] },
      undefined,
      true,
    );
  };
  function next(skip = false) {
    if (!p || busy) return;
    if (!skip && pending) {
      setError(
        "Choose a suggestion or add your typed answer before continuing.",
      );
      return;
    }
    const issue = skip ? null : validationFor(step, p);
    if (issue) {
      setError(issue);
      return;
    }
    if (skip && (salary || step === "compensation")) {
      update({ payEnabled: false });
      go("evidence");
      return;
    }
    if (skip && ["evidence", "sample-url", "contribution"].includes(step)) {
      update({ sampleChoice: "later" });
      go("review");
      return;
    }
    const following = steps[index + 1];
    if (following) go(following);
  }
  return (
    <div className="onboarding">
      <header className="onb-header">
        <Link to="/" className="brand" aria-label="Apply at Ease home">
          <span className="brand-mark">
            <Sprout size={20} />
          </span>
          <span className="brand-name">
            apply<span>atease</span>
          </span>
        </Link>
        <div>
          <SaveStatus />
          <Link to="/" className="onb-exit">
            Save & exit <X size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <nav className="onb-progress" aria-label="Setup progress">
        <ol>
          {phases.map((label, n) => {
            const phaseSteps = p
              ? steps.filter((s) => questionFor(s, p).phase === n)
              : [];
            const completed = phaseSteps.filter(
              (s) => steps.indexOf(s) < index,
            ).length;
            return (
              <li
                key={label}
                data-state={
                  n < question.phase
                    ? "done"
                    : n === question.phase
                      ? "current"
                      : "next"
                }
                aria-current={n === question.phase ? "step" : undefined}
              >
                <div>
                  <span>
                    {n < question.phase ? <Check size={13} /> : `0${n + 1}`}
                  </span>
                  <strong>{label}</strong>
                </div>
                <span className="onb-progress-segment" aria-hidden="true">
                  <span
                    style={{
                      width: `${phaseSteps.length ? (completed / phaseSteps.length) * 100 : 0}%`,
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ol>
        <progress
          className="onb-progress-total"
          value={Math.max(index, 0)}
          max={Math.max(steps.length - 1, 1)}
          aria-label="Onboarding progress"
        />
      </nav>
      {!p ? (
        <div className="onb-loading">
          <SaveStatus detailed />
        </div>
      ) : (
        <main className={`onb-main ${step === "review" ? "onb-wide" : ""}`}>
          <div className="onb-question-meta">
            <Button
              className="onb-back"
              disabled={index <= 0 || busy}
              onClick={() => {
                const previous = steps[index - 1];
                if (previous) go(previous);
              }}
            >
              <ArrowLeft size={15} /> Back
            </Button>
            {p.visited.includes("review") && step !== "review" ? (
              <Button
                className="onb-text"
                disabled={busy}
                onClick={() => go("review")}
              >
                Back to review
              </Button>
            ) : (
              <span>
                {interlude
                  ? "A little perspective"
                  : `Step ${index + 1} of ${steps.length}`}
              </span>
            )}
          </div>
          <div className="onb-screen" key={step}>
            <p className="onb-eyebrow">
              {step === "review"
                ? "Made for your next move"
                : phases[question.phase]}
            </p>
            <h1 id="onboarding-question" ref={heading} tabIndex={-1}>
              {question.title}
            </h1>
            {question.detail && (
              <p className="onb-subtitle">{question.detail}</p>
            )}
            {step === "review" ? (
              <ProfileReview
                onEdit={go}
                onFinish={() => void navigate({ to: "/profile" })}
              />
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
                aria-labelledby="onboarding-question"
              >
                <div className="onb-content">
                  <QuestionBody
                    key={step}
                    step={step}
                    busy={busy}
                    onBusy={setBusy}
                    onError={setError}
                    onPending={setPending}
                  />
                </div>
                {error && (
                  <p role="alert" className="onb-error">
                    {error}
                  </p>
                )}
                <div className="onb-actions">
                  <Button type="submit" className="onb-primary" disabled={busy}>
                    {busy
                      ? "Reading your document…"
                      : step === "cv" && p.cv
                        ? "Review CV text"
                        : "Continue"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </Button>
                  {step !== "roles" && !interlude && (
                    <Button
                      type="button"
                      className="onb-skip"
                      disabled={busy}
                      onClick={() => next(true)}
                    >
                      {step === "cv" && !p.cv
                        ? "Continue without a CV"
                        : salary
                          ? "Set compensation preferences later"
                          : ["sample-url", "contribution"].includes(step)
                            ? "Leave work samples for later"
                            : "Leave this for later"}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </div>
          {status === "error" && <SaveStatus detailed />}
          <footer className="onb-footer">
            <LockKeyhole size={13} />
            Your profile stays on this device. Nothing is sent to employers.
          </footer>
        </main>
      )}
    </div>
  );
}
