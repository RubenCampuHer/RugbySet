import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AttendanceValue = "accepted" | "declined" | "none";

/**
 * Par de botones sí/no de asistencia — unifica los controles duplicados de
 * PlayerAttendance y CoachRollCall (antes con glifos "✓"/"✗" de texto).
 * size="lg" da objetivo táctil de 44px (icon-xl); "sm" para filas densas.
 */
export function AttendanceToggle({
  value,
  onChange,
  disabled,
  size = "lg",
  labels = false,
}: {
  value: AttendanceValue;
  onChange: (status: "accepted" | "declined") => void;
  disabled?: boolean;
  size?: "sm" | "lg";
  /** Si true, muestra texto junto al icono (uso jugador); si false, solo icono (pasar lista). */
  labels?: boolean;
}) {
  const btnSize = size === "lg" ? "icon-xl" : "icon-lg";

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size={labels ? "xl" : btnSize}
        variant={value === "accepted" ? "default" : "secondary"}
        disabled={disabled}
        aria-label="Sí asisto"
        aria-pressed={value === "accepted"}
        className={cn(
          value === "accepted" && "bg-accent text-accent-foreground hover:bg-accent/85",
        )}
        onClick={() => onChange("accepted")}
      >
        <Check className={labels ? "size-4" : "size-5"} />
        {labels && "Sí voy"}
      </Button>
      <Button
        type="button"
        size={labels ? "xl" : btnSize}
        variant={value === "declined" ? "destructive" : "secondary"}
        disabled={disabled}
        aria-label="No asisto"
        aria-pressed={value === "declined"}
        onClick={() => onChange("declined")}
      >
        <X className={labels ? "size-4" : "size-5"} />
        {labels && "No voy"}
      </Button>
    </div>
  );
}
