"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { setDeclineReason } from "@/lib/actions/team";
import { declineReason } from "@/lib/attendance";
import type { Team, TrainingDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_REASONS = ["Trabajo", "Estudios", "Lesión", "Enfermedad", "Viaje"];

/**
 * Motivo opcional al decir que no (2026-09-25): se abre justo después de
 * responder "No" y el jugador puede omitirlo. Lo ve el cuerpo técnico en el
 * panel del día y al pasar lista. Solo web.
 */
function DeclineReasonDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: string;
  onClose: () => void;
  onSave: (reason: string | null) => Promise<void>;
}) {
  const [reason, setReason] = useState(initial);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(reason.trim() || null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Por qué no puedes ir?</DialogTitle>
          <DialogDescription>Opcional. Solo lo verá tu cuerpo técnico.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={reason === r}
              className={cn(reason === r && "border-brand text-brand")}
              onClick={() => setReason(r)}
            >
              {r}
            </Button>
          ))}
        </div>
        <Textarea
          value={reason}
          maxLength={200}
          rows={2}
          placeholder="O escríbelo tú…"
          aria-label="Motivo"
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Omitir
          </Button>
          <Button disabled={busy || !reason.trim()} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar motivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ask(day) abre el diálogo para ese día; clear(day) borra el motivo si lo hay
 * (al cambiar a "sí"). `dialog` se pinta una vez en la página.
 */
export function useDeclineReason(team: Team | null | undefined, uid: string | undefined) {
  const [day, setDay] = useState<TrainingDay | null>(null);

  const write = (d: TrainingDay, reason: string | null) =>
    setDeclineReason({ teamname: team!.teamname!, fecha: d.fecha!, uid: uid!, reason });

  const clear = async (d: TrainingDay) => {
    if (!team || !uid || !declineReason(team, d, uid)) return;
    await write(d, null).catch(() => {}); // si falla, el motivo antiguo solo queda de más
  };

  const dialog =
    day && team && uid ? (
      <DeclineReasonDialog
        key={day.fecha}
        initial={declineReason(team, day, uid) ?? ""}
        onClose={() => setDay(null)}
        onSave={async (reason) => {
          try {
            await write(day, reason);
            toast.success("Motivo guardado");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo guardar el motivo");
            throw e;
          }
        }}
      />
    ) : null;

  return { ask: setDay, clear, dialog };
}
