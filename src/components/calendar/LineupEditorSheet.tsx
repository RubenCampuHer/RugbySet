"use client";

import { LineupEditor } from "@/components/calendar/LineupEditor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { LineupDoc, Team } from "@/lib/types";

/**
 * Envoltorio Sheet fino alrededor de LineupEditor (sin duplicar su
 * lógica) — para poder abrirlo como modal desde /team/lineups, igual que
 * EventEditorSheet ya es un Sheet para los campos del evento. No se
 * autocierra al guardar/publicar (sería molesto guardando mientras se
 * sigue editando) — el propio Sheet ya trae su botón de cerrar.
 */
export function LineupEditorSheet({
  team,
  lineup,
  open,
  onOpenChange,
}: {
  team: Team;
  lineup: LineupDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{lineup?.name || "Alineación"}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          {lineup && (
            <LineupEditor team={team} lineup={lineup} onDeleted={() => onOpenChange(false)} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
