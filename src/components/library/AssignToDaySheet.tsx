"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { upsertTrainingDay } from "@/lib/actions/team";
import { fechaToInputValue, inputValueToFecha, keyToParam, todayKey } from "@/lib/calendar";
import type { Team, Training } from "@/lib/types";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * "Asignar a un día" desde la ficha del entreno (2026-09-23): lo pone en el
 * calendario del equipo activo sin pasar por el calendario. Si ese día ya hay
 * un evento, solo se sustituye su entreno: se conservan tipo, nombre, lugar y
 * respuestas (upsertTrainingDay fusiona sobre el dato crudo).
 */
export function AssignToDaySheet({ team, training }: { team: Team; training: Training }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(fechaToInputValue(todayKey()));
  const [horaInicio, setHoraInicio] = useState("18:00");
  const [horaFin, setHoraFin] = useState("19:30");
  const [busy, setBusy] = useState(false);

  const fecha = inputValueToFecha(dateValue);
  const existing = fecha ? team.trainingdays.find((d) => d.fecha === fecha) : undefined;

  const pickDate = (value: string) => {
    setDateValue(value);
    const f = inputValueToFecha(value);
    const day = f ? team.trainingdays.find((d) => d.fecha === f) : undefined;
    if (day?.horaInicio) setHoraInicio(day.horaInicio);
    if (day?.horaFin) setHoraFin(day.horaFin);
  };

  const save = async () => {
    if (!fecha) {
      toast.error("Elige una fecha");
      return;
    }
    if (!TIME_RE.test(horaInicio) || !TIME_RE.test(horaFin) || horaInicio >= horaFin) {
      toast.error("Revisa las horas: el inicio debe ser anterior al fin");
      return;
    }
    setBusy(true);
    try {
      await upsertTrainingDay(team.teamname!, {
        fecha,
        horaInicio,
        horaFin,
        training,
        nameTrainingDay: existing?.nameTrainingDay ?? "",
        eventType: existing?.eventType === "MATCH" ? "MATCH" : "TRAINING",
        location: existing?.location ?? null,
      });
      toast.success(
        existing ? `Entreno sustituido el ${fecha}` : `Entreno añadido al calendario el ${fecha}`,
      );
      setOpen(false);
      router.push(`/calendar?date=${keyToParam(fecha)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" />}>
        <CalendarPlus className="size-4" /> Asignar a un día
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Asignar a un día</SheetTitle>
          <SheetDescription>
            «{training.name}» en el calendario de {team.teamname}.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="space-y-1">
            <Label htmlFor="assign-date" className="text-xs">Fecha</Label>
            <Input
              id="assign-date"
              type="date"
              value={dateValue}
              onChange={(e) => pickDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="assign-start" className="text-xs">Inicio</Label>
              <Input
                id="assign-start"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assign-end" className="text-xs">Fin</Label>
              <Input
                id="assign-end"
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
              />
            </div>
          </div>
          {existing && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Ese día ya hay{" "}
              <span className="font-medium text-foreground">
                {existing.nameTrainingDay ||
                  existing.training?.name ||
                  (existing.eventType === "MATCH" ? "un partido" : "un entreno")}
              </span>
              . Se sustituirá su entreno y se conservarán las respuestas del equipo.
            </p>
          )}
        </div>
        <SheetFooter>
          <Button size="xl" disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : existing ? "Sustituir el entreno de ese día" : "Añadir al calendario"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
