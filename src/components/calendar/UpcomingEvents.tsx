"use client";

import { Ban, CalendarClock, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agendaGroups, limitGroups, relativeDayLabel } from "@/lib/agenda";
import { WEEKDAY_SHORT } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Team, TrainingDay } from "@/lib/types";

/**
 * Agenda del equipo (2026-09-23): próximos o pasados, agrupados por semana,
 * con fecha relativa y recuento "Van X de Y". Evita que el jugador tenga que
 * "cazar" días coloreados en el grid del mes para responder.
 */
export function UpcomingEvents({
  team,
  isCoach,
  myUid,
  onSelectDay,
  onAnswer,
  limit = 6,
}: {
  team: Team;
  isCoach: boolean;
  myUid: string;
  onSelectDay: (fecha: string) => void;
  onAnswer: (day: TrainingDay, status: "accepted" | "declined") => void;
  limit?: number;
}) {
  const [mode, setMode] = useState<"upcoming" | "past">("upcoming");
  const [shown, setShown] = useState(limit);
  const groups = useMemo(() => agendaGroups(team, mode), [team, mode]);
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const playerCount = Object.keys(team.userplayers).length;

  const visible = limitGroups(groups, shown);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Agenda</h2>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as "upcoming" | "past");
            setShown(limit);
          }}
        >
          <TabsList>
            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
            <TabsTrigger value="past">Pasados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {total === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {mode === "upcoming"
            ? isCoach
              ? "No hay nada programado. Toca un día del calendario para añadir un entreno o un partido."
              : "No hay nada programado todavía."
            : "Aún no hay eventos pasados."}
        </p>
      )}

      {visible.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          {group.entries.map(({ day, date }) => {
            const isMatch = day.eventType === "MATCH";
            const cancelled = day.cancelled === true;
            const accepted = day.accepted_players[myUid] === true;
            const declined = day.declined_players[myUid] === true;
            const going = Object.keys(day.accepted_players).length;
            const activate = () => onSelectDay(day.fecha!);

            return (
              // Fila-agenda: div (no button) porque contiene botones propios
              // (AttendanceToggle) — un <button> anidado no es HTML válido.
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
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  cancelled && "opacity-60",
                )}
              >
                <div
                  className={cn(
                    "flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 text-white",
                    cancelled ? "bg-muted-foreground" : isMatch ? "bg-warning" : "bg-primary",
                  )}
                >
                  <span className="text-[10px] font-medium uppercase">
                    {WEEKDAY_SHORT[date.getDay()]}
                  </span>
                  <span className="text-lg leading-none font-bold">{date.getDate()}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {cancelled ? (
                      <Badge variant="outline" className="gap-1">
                        <Ban className="size-3" /> Cancelado
                      </Badge>
                    ) : (
                      isMatch && (
                        <Badge className="border-transparent bg-warning/15 text-warning">
                          Partido
                        </Badge>
                      )
                    )}
                    <span className={cn("truncate", cancelled && "line-through")}>
                      {day.nameTrainingDay || day.training?.name || (isMatch ? "Partido" : "Entreno")}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" /> {relativeDayLabel(day.fecha!)} ·{" "}
                      {day.horaInicio}–{day.horaFin}
                    </span>
                    {day.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {day.location}
                      </span>
                    )}
                  </p>
                  {!cancelled && (
                    <p className="text-xs text-muted-foreground">
                      {mode === "upcoming" ? "Van" : "Fueron"} {going} de {playerCount}
                    </p>
                  )}
                </div>

                {!isCoach && !cancelled && mode === "upcoming" && (
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
      ))}

      {total > shown && (
        <Button variant="ghost" className="w-full" onClick={() => setShown((n) => n + limit * 2)}>
          Ver más ({total - shown})
        </Button>
      )}
    </div>
  );
}
