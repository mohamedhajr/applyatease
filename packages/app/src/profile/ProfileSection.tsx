import { Button } from "@base-ui/react/button";
import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

interface ProfileSectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  onEdit?: () => void;
}
export function ProfileSection({
  id,
  title,
  description,
  children,
  onEdit,
}: ProfileSectionProps) {
  return (
    <section
      id={id}
      className="candidate-section"
      aria-labelledby={`${id}-title`}
    >
      <header className="candidate-section-heading">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {onEdit && <EditButton label={title} onClick={onEdit} />}
      </header>
      {children}
    </section>
  );
}
interface EditButtonProps {
  label: string;
  onClick: () => void;
}
export function EditButton({ label, onClick }: EditButtonProps) {
  return (
    <Button
      className="candidate-edit"
      aria-label={`Edit ${label}`}
      onClick={onClick}
    >
      <Pencil size={13} aria-hidden="true" /> Edit
    </Button>
  );
}
interface DetailRowProps {
  label: string;
  children: ReactNode;
  onEdit?: () => void;
}
export function DetailRow({ label, children, onEdit }: DetailRowProps) {
  return (
    <div className="candidate-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {onEdit && <EditButton label={label} onClick={onEdit} />}
    </div>
  );
}
