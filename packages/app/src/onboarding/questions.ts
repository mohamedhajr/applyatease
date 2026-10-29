import {
  creativeProfile,
  experienceStep,
  countryForStep,
  payFor,
  employmentOptions,
  effectiveAnalysis,
  payForStep,
  roleForStep,
  type Profile,
  type Step,
} from "./model.ts";
export const phases = [
  "Your starting point",
  "Your direction",
  "What matters",
  "Review",
];
export type Question = { title: string; detail: string; phase: number };
const q = (title: string, detail: string, phase: number): Question => ({
  title,
  detail,
  phase,
});
const questions: Record<string, Question> = {
  goal: q(
    "What’s your next move?",
    "A little direction now. Room to change your mind later.",
    0,
  ),
  cv: q(
    "Start with what you’ve already done.",
    "Bring your English CV. There’s no need to type your career history again.",
    0,
  ),
  "cv-analysis": q(
    "Your experience, in perspective.",
    "Analyze your CV for source-backed suggestions, or continue manually.",
    0,
  ),
  "work-modes": q(
    "Where would you like to work?",
    "Choose every work mode you’re open to.",
    1,
  ),
  "in-person": q(
    "Where could you work in person?",
    "Select physical work countries, including your current country if relevant. Employer headquarters are separate.",
    1,
  ),
  "cv-review": q(
    "Does this look like your story?",
    "Check the text from every page against your original before using it as a career source.",
    0,
  ),
  "cv-notes": q(
    "Anything missing or out of date?",
    "Leave a correction or a note about your CV. This doesn’t change your original file.",
    0,
  ),
  "cv-story": q("Your experience. Still in your words.", "", 0),
  roles: q(
    "What kind of work feels right?",
    "Search for a title and add the tracks you want to explore.",
    1,
  ),
  direction: q("A direction that’s yours.", "", 1),
  location: q(
    "Where will you work from?",
    "Choose the country where you’ll physically work. A remote employer can still have location requirements.",
    1,
  ),
  residence: q(
    "Where do you currently live?",
    "Your residence can differ from your working country. Keep the two separate.",
    1,
  ),
  overlap: q(
    "When can you overlap with a team?",
    "Include a time zone. These are preferred hours, not a commitment to an employer’s schedule.",
    1,
  ),
  work: q(
    "How would you like to work?",
    "Choose every employment arrangement you’re open to.",
    1,
  ),
  eligibility: q("Are you currently authorized to work?", "", 2),
  "sponsorship-now": q("Would you need sponsorship now?", "", 2),
  "sponsorship-later": q("Would you need sponsorship in the future?", "", 2),
  preferences: q(
    "When could you start?",
    "Choose what fits today. A specific start date can wait for a real opportunity.",
    2,
  ),
  travel: q(
    "How do you feel about work travel?",
    "Some remote roles include customer or team visits. Keep this separate from working remotely.",
    2,
  ),
  exclusions: q(
    "Anything you’d rather avoid?",
    "Add employers, industries or other boundaries that matter to your search. This is optional.",
    2,
  ),
  compensation: q(
    "Want to set pay preferences?",
    "Your private minimum and your target are different. Neither becomes an employer-facing answer without your review.",
    2,
  ),
  evidence: q(
    "Anything your CV doesn’t show?",
    "An existing work sample can add context. You can also leave this until a role needs it.",
    2,
  ),
  "sample-url": q(
    "Where can we see your work?",
    "Add an existing portfolio, project or work-sample link. We won’t open it or infer ownership.",
    2,
  ),
  contribution: q(
    "What was your contribution?",
    "A brief factual note is enough. Include only work you’re allowed to share.",
    2,
  ),
  review: q(
    "Your next chapter, in focus.",
    "Review your search profile. Every answer is editable, now and later.",
    3,
  ),
};
export function questionFor(step: Step, p: Profile): Question {
  const experienceRole = p.roles.find((r) => experienceStep(r.title) === step);
  if (experienceRole)
    return q(
      `What is your experience in ${experienceRole.title}?`,
      "Confirm your current experience in this direction. Your desired next level comes separately.",
      1,
    );
  const country = countryForStep(step, p);
  if (country)
    return q(
      step.startsWith("country:")
        ? `What is your work authorization status in ${country}?`
        : step.startsWith("sponsor:")
          ? `Would you need sponsorship now in ${country}?`
          : `Might you need sponsorship later in ${country}?`,
      "Your answer applies to this physical work country. Actual employer declarations need their own review.",
      2,
    );
  if (step === "roles" && effectiveAnalysis(p)?.roles.length)
    return q(
      "Do these directions match what you’re looking for?",
      "Choose suggestions, add another role or explore a career change. Suggestions are not qualifications.",
      1,
    );
  const role = roleForStep(step, p);
  if (role)
    return q(
      `What level for ${role.title}?`,
      "This is the level you want to search for, not a claim about your qualifications.",
      1,
    );
  const salary = payForStep(step);
  if (salary) {
    const pay = payFor(p, salary.basis);
    const basis = `${employmentOptions.find(([code]) => code === salary.basis)?.[1]} · ${salary.basis.includes("contract") ? "before tax and expenses" : "gross pay"}`;
    const context = `${basis}${pay.currency ? ` · ${pay.currency}` : ""}${pay.period ? ` / ${pay.period}` : ""}`;
    const title =
      salary.question === "currency"
        ? "Which currency should we use?"
        : salary.question === "period"
          ? "What pay period do you mean?"
          : salary.question === "minimum"
            ? "What’s your private minimum?"
            : "What would you like to aim for?";
    return q(title, context, 2);
  }
  if (step === "direction" && creativeProfile(p))
    return q("Let your work tell the story.", "", 1);
  if (["eligibility", "sponsorship-now", "sponsorship-later"].includes(step))
    return q(
      questions[step]!.title,
      `For employment in ${p.country}. Your answer is scoped to this country; exact employer declarations still need their own review.`,
      2,
    );
  return questions[step] ?? questions.roles!;
}
