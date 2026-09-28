"use client";

import { Ban, Check, Clock, Minus, X } from "lucide-react";
import { useMemo } from "react";
import { ATTENDANCE_MARK_LABEL, playerWeek, type WeekSession } from "@/lib/attendance";
import { WEEKDAY_SHORT } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

const RSVP_LABEL: Record<WeekSession["rsvp"], string> = {
  accepted: "Dijiste que vas",
  declined: "Dijiste que no",
  none: "Sin responder",
};

/** Icono + texto: el estado nunca va solo por color. */
function State({ s }: { s: WeekSession }) {
  switch (s.state) {
    case "attended":
      return (
        <span className="flex items-center gap-1 text-accent">
          <Check className="size-3.5" /> {s.mark === "late" ? ATTENDANCE_MARK_LABEL.late : "Fuiste"}
        </span>
      );
    case "missed":
      return (
        <span className="flex items-center gap-1 text-destructive">
          <X className="size-3.5" /> Faltaste
        </span>
      );
    case "excluded":
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Minus className="size-3.5" /> {s.mark ? ATTENDANCE_MARK_LABEL[s.mark] : "No cuenta"}
        </span>
      );
    case "cancelled":
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Ban className="size-3.5" /> Cancelado
        </span>
      );
    case "upcoming":
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3.5" /> {RSVP_LABEL[s.rsvp]}
        </span>
      );
  }
}

function summary(attended: number, counted: number, upcoming: number): string {
  const parts: string[] = [];
  if (counted > 0) parts.push(`Has ido a ${attended} de ${counted}`);
  if (upcoming > 0) parts.push(`${upcoming} por delante`);
  return parts.join(" · ");
}

/**
 * Esta semana del jugador, sesión a sesión (2026-09-28): las ya pasadas con si
 * fue (marca real al pasar lista o, si no, su respuesta) y las que quedan con
 * lo que respondió. Solo sus datos, nada de compañeros.
 */
export function PlayerWeekList({ team, uid }: { team: Team; uid: string }) {
  const week = useMemo(() => playerWeek(team, uid), [team, uid]);

  return (
    <div className="space-y-2 border-b border-border pb-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Tu semana</p>
        <p className="text-xs text-muted-foreground">{summary(week.attended, week.counted, week.upcoming)}</p>
      </div>
      {week.sessions.length === 0 ? (
        <p className="text-muted-foreground">Esta semana no hay entrenos ni partidos.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg bg-muted/50">
          {week.sessions.map((s) => (
            <li
              key={`${s.fecha}-${s.day.horaInicio ?? ""}`}
              className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <span className={cn("min-w-0 truncate", s.state === "cancelled" && "line-through")}>
                <span className="font-medium">
                  {WEEKDAY_SHORT[s.date.getDay()].toLowerCase()} {s.date.getDate()}
                </span>
                <span className="text-muted-foreground">
                  {" · "}
                  {s.day.nameTrainingDay || (s.day.eventType === "MATCH" ? "Partido" : "Entreno")}
                  {s.day.horaInicio ? ` · ${s.day.horaInicio}` : ""}
                </span>
              </span>
              <span className="shrink-0">
                <State s={s} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
