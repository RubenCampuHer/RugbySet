"use client";

import { ChevronRight, Trash2, Trophy, Volleyball } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TrainingPickerSheet } from "@/components/calendar/TrainingPickerSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTrainings } from "@/hooks/useTrainings";
import { deleteTrainingDay, upsertTrainingDay } from "@/lib/actions/team";
import { cn } from "@/lib/utils";
import type { Team, TrainingDay } from "@/lib/types";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Editor de sesión del coach en un Sheet inferior (equivalente al bottom
 * sheet de Android): tipo de evento, nombre, horas con <input type="time">
 * (sustituye el texto+regex), ubicación y selector de entreno con búsqueda
 * y filtro por etiqueta (TrainingPickerSheet).
 */
export function EventEditorSheet({
  team,
  fecha,
  day,
  open,
  onOpenChange,
}: {
  team: Team;
  fecha: string;
  day: TrainingDay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { trainings } = useTrainings();
  const [horaInicio, setHoraInicio] = useState(day?.horaInicio ?? "18:00");
  const [horaFin, setHoraFin] = useState(day?.horaFin ?? "19:30");
  const [trainingName, setTrainingName] = useState(day?.training?.name ?? "");
  const [eventType, setEventType] = useState<"TRAINING" | "MATCH">(
    day?.eventType === "MATCH" ? "MATCH" : "TRAINING",
  );
  const [eventName, setEventName] = useState(day?.nameTrainingDay ?? "");
  const [location, setLocation] = useState(day?.location ?? "");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedTraining = trainings.find((t) => t.name === trainingName);

  const isMatch = eventType === "MATCH";

  const save = async () => {
    if (!TIME_RE.test(horaInicio) || !TIME_RE.test(horaFin)) {
      toast.error("Horas inválidas");
      return;
    }
    if (horaInicio >= horaFin) {
      toast.error("La hora de inicio debe ser anterior a la de fin");
      return;
    }
    // El entreno (plantilla de ejercicios) solo tiene sentido para un
    // Entrenamiento — un Partido no lleva ninguno adjunto (Android ya lo
    // permitía así, la web lo forzaba solo aquí).
    let training;
    if (!isMatch) {
      training = trainings.find((t) => t.name === trainingName);
      if (!training) {
        toast.error("Elige un entreno");
        return;
      }
    }
    setBusy(true);
    try {
      await upsertTrainingDay(
        team.teamname!,
        { fecha, horaInicio, horaFin, training, nameTrainingDay: eventName, eventType, location },
      );
      toast.success(
        day
          ? isMatch
            ? "Partido actualizado"
            : "Entreno actualizado"
          : isMatch
            ? "Partido creado"
            : "Entreno creado",
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await deleteTrainingDay(team.teamname!, fecha);
    toast.success(isMatch ? "Partido borrado" : "Entreno borrado");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{day ? "Editar evento" : "Añadir evento"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={eventType === "TRAINING" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setEventType("TRAINING")}
            >
              <Volleyball className="size-4" /> Entreno
            </Button>
            <Button
              type="button"
              variant={eventType === "MATCH" ? "default" : "outline"}
              className={cn(
                "flex-1",
                eventType === "MATCH" && "bg-warning text-warning-foreground hover:bg-warning/90",
              )}
              onClick={() => setEventType("MATCH")}
            >
              <Trophy className="size-4" /> Partido
            </Button>
          </div>

          <div className="space-y-1">
            <Label htmlFor="eventName" className="text-xs">Nombre del evento (opcional)</Label>
            <Input
              id="eventName"
              value={eventName}
              placeholder="p.ej. Vs. Leones RC"
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="horaInicio" className="text-xs">Inicio</Label>
              <Input
                id="horaInicio"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="horaFin" className="text-xs">Fin</Label>
              <Input
                id="horaFin"
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs">Ubicación (opcional)</Label>
            <Input
              id="location"
              value={location}
              placeholder="p.ej. Campo Municipal"
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {!isMatch && (
            <div className="space-y-1">
              <Label className="text-xs">Entreno</Label>
              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full justify-between font-normal"
                onClick={() => setPickerOpen(true)}
              >
                <span className={cn("line-clamp-1 text-left", !selectedTraining && "text-muted-foreground")}>
                  {selectedTraining
                    ? `${selectedTraining.name} (${selectedTraining.tiempoTotal ?? "?"} min)`
                    : "Elegir entreno…"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>

        {!isMatch && (
          <TrainingPickerSheet
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            value={trainingName}
            onConfirm={(name) => {
              setTrainingName(name);
              setPickerOpen(false);
            }}
          />
        )}

        <SheetFooter>
          <Button size="xl" disabled={busy} onClick={() => void save()}>
            {day ? "Guardar cambios" : isMatch ? "Crear partido" : "Crear entreno"}
          </Button>
          {day && (
            <ConfirmDialog
              trigger={
                <Button size="xl" variant="destructive" disabled={busy}>
                  <Trash2 className="size-4" /> Borrar día
                </Button>
              }
              title={`¿Borrar el ${isMatch ? "partido" : "entreno"} del ${fecha}?`}
              confirmLabel="Borrar"
              destructive
              onConfirm={remove}
            />
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
