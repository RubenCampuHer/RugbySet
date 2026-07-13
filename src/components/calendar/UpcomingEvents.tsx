"use client";

import { CalendarClock, Check, MapPin, X } from "lucide-react";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { Badge } from "@/components/ui/badge";
import { WEEKDAY_SHORT, parseKey } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Team, TrainingDay } from "@/lib/types";

/**
 * Lista de próximos eventos en formato agenda — evita que el jugador tenga
 * que "cazar" días coloreados en el grid del mes para confirmar asistencia.
 */
export function UpcomingEvents({
  team,
  isCoach,
  myName,
  onSelectDay,
  onAnswer,
  limit = 5,
}: {
  team: Team;
  isCoach: boolean;
  myName: string;
  onSelectDay: (fecha: string) => void;
  onAnswer: (day: TrainingDay, status: "accepted" | "declined") => void;
  limit?: number;
}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = team.trainingdays
    .map((day) => ({ day, date: day.fecha ? parseKey(day.fecha) : null }))
    .filter((x): x is { day: TrainingDay; date: Date } => x.date !== null && x.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);

  if (upcoming.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No hay próximos entrenos programados.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Próximos eventos</h2>
      <div className="space-y-2">
        {upcoming.map(({ day, date }) => {
          const isMatch = day.eventType === "MATCH";
          const accepted = day.accepted_players.includes(myName);
          const declined = day.declined_players.includes(myName);
          const noAnswer = team.userplayers.filter(
            (n) => !day.accepted_players.includes(n) && !day.declined_players.includes(n),
          ).length;

          const activate = () => onSelectDay(day.fecha!);

          return (
            // Fila-agenda: div (no button) porque contiene botones propios
            // (AttendanceToggle) — un <button> anidado dentro de otro no es
            // válido en HTML.
            <div
              key={day.fecha}
              role="button"
              tabIndex={0}
              onClick={activate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activate();
                }
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div
                className={cn(
                  "flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 text-white",
                  isMatch ? "bg-warning" : "bg-primary",
                )}
              >
                <span className="text-[10px] font-medium uppercase">
                  {WEEKDAY_SHORT[date.getDay()]}
                </span>
                <span className="text-lg leading-none font-bold">{date.getDate()}</span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {isMatch && (
                    <Badge className="border-transparent bg-warning/15 text-warning">
                      Partido
                    </Badge>
                  )}
                  {day.nameTrainingDay || day.training?.name || "Entreno"}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" /> {day.horaInicio}–{day.horaFin}
                  </span>
                  {day.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {day.location}
                    </span>
                  )}
                </p>
              </div>

              {isCoach ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Check className="size-3" /> {day.accepted_players.length}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <X className="size-3" /> {day.declined_players.length}
                  </span>
                  <span>{noAnswer}—</span>
                </span>
              ) : (
                <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <AttendanceToggle
                    value={accepted ? "accepted" : declined ? "declined" : "none"}
                    onChange={(status) => onAnswer(day, status)}
                    size="sm"
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
