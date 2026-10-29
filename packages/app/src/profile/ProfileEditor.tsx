import { Dialog } from "@base-ui/react/dialog";
import { useRef, useState, type RefObject } from "react";
import { Button } from "@base-ui/react/button";
import { X } from "lucide-react";
import { QuestionBody } from "../onboarding/QuestionBody.tsx";
import { questionFor } from "../onboarding/questions.ts";
import { useProfile } from "../onboarding/ProfileProvider.tsx";
import { SaveStatus } from "../onboarding/ProfileReview.tsx";
import {
  confirmStep,
  payForStep,
  payStep,
  skipStep,
  validationFor,
  type Step,
} from "../onboarding/model.ts";

interface ProfileEditorProps {
  step: Step;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}
export function ProfileEditor({
  step,
  onClose,
  returnFocus,
}: ProfileEditorProps) {
  const { data, status, update } = useProfile();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  if (!data) return null;
  const question = questionFor(step, data.profile);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="candidate-backdrop" />
        <Dialog.Popup
          className="candidate-editor"
          initialFocus={title}
          finalFocus={returnFocus}
        >
          <header className="candidate-editor-header">
            <div>
              <p className="candidate-eyebrow">Edit your profile</p>
              <Dialog.Title ref={title} tabIndex={-1} id="onboarding-question">
                {question.title}
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="candidate-close"
              aria-label="Close editor"
              disabled={busy}
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <Dialog.Description className="candidate-muted">
            {question.detail ||
              "Changes are saved here as you go. Your other profile details stay in place."}
          </Dialog.Description>
          <div className="candidate-editor-body">
            <QuestionBody
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
          {status === "error" && <SaveStatus detailed />}
          <p className="candidate-footnote">
            Changes save as you make them. Closing returns to your profile.
          </p>
          <footer className="candidate-editor-footer">
            <SaveStatus />
            <Button
              className="candidate-link"
              disabled={busy || status === "error"}
              onClick={() => {
                update(skipStep(data.profile, step), undefined, true);
                onClose();
              }}
            >
              Leave for later
            </Button>
            <Button
              className="candidate-primary"
              disabled={busy || pending || status !== "saved"}
              onClick={() => {
                const pay = payForStep(step);
                const issue =
                  validationFor(step, data.profile) ??
                  (pay?.question === "minimum"
                    ? validationFor(payStep(pay.basis, "target"), data.profile)
                    : null);
                if (issue) setError(issue);
                else {
                  update(confirmStep(data.profile, step), undefined, true);
                  onClose();
                }
              }}
            >
              Done
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
