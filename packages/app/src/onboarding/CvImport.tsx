import { Button } from "@base-ui/react/button";
import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import { useProfile } from "./ProfileProvider.tsx";

export function CvImport({
  busy,
  onBusy,
  onError,
}: {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const { data, importCv, removeCv } = useProfile();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const cv = data?.profile.cv;
  async function importFile(file: File | undefined) {
    if (!file || busy) return;
    onBusy(true);
    onError("");
    try {
      await importCv(file);
    } catch (error) {
      if (mounted.current)
        onError(
          error instanceof Error
            ? error.message
            : "The CV could not be read. Please try another file.",
        );
    } finally {
      if (mounted.current) onBusy(false);
    }
  }
  return (
    <>
      <div className="onb-upload">
        <span className="onb-upload-icon">
          <FileText size={28} strokeWidth={1.4} />
        </span>
        <h2>
          {cv
            ? "Your original is kept intact."
            : "Your experience is a good starting point."}
        </h2>
        <p>
          PDF or DOCX · up to 10 MB
          <br />
          Read locally, without uploading to a server.
        </p>
        <label className="onb-file-button">
          {cv ? "Choose a different CV" : "Choose your CV"}
          <input
            aria-label="Choose your CV"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={busy}
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {cv && (
        <div className="onb-file-row">
          <FileText size={20} />
          <div>
            <strong>{cv.name}</strong>
            <small>
              {!cv.sections.some((s) => s.text.trim())
                ? "Original preserved · readable extraction unavailable"
                : cv.reviewedAt
                  ? "Text reviewed"
                  : "Text extracted · review next"}
            </small>
          </div>
          <Button type="button" className="onb-text" onClick={removeCv}>
            Remove CV
          </Button>
        </div>
      )}
      <p className="onb-hint">
        Only add your own CV or one you’re authorized to use. Scanned files need
        OCR, which isn’t connected yet. The original is never rewritten.
      </p>
    </>
  );
}
