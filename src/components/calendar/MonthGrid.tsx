"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTHS, WEEKDAYS, toKey, todayKey } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { TrainingDay } from "@/lib/types";

/**
 * Grid del mes: indicador de hoy (ring), día seleccionado (fondo primary),
 * puntos de color real por tipo de evento (entreno/partido) y por
 * asistencia — sustituye la leyenda "■ ■" de texto sin color y la
 * codificación de estado solo-por-fondo.
 */
export function MonthGrid({
  year,
  month,
  daysByFecha,
  attended,
  selected,
  onSelect,
  onPrevMonth,
  onNextMonth,
  onToday,
}: {
  year: number;
  month: number;
  daysByFecha: Map<string, TrainingDay>;
  attended: Set<string>;
  selected: string | null;
  onSelect: (fecha: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const today = todayKey();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-xl" aria-label="Mes anterior" onClick={onPrevMonth}>
          <ChevronLeft className="size-5" />
        </Button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {MONTHS[month]} {year}
        </button>
        <Button variant="ghost" size="icon-xl" aria-label="Mes siguiente" onClick={onNextMonth}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = toKey(year, month, day);
          const session = daysByFecha.get(key);
          const isMatch = session?.eventType === "MATCH";
          const wasAttended = attended.has(key);
          const isToday = key === today;
          const isSelected = selected === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                isToday && !isSelected && "font-semibold ring-2 ring-brand",
              )}
            >
              {day}
              <span className="flex h-1.5 items-center gap-0.5">
                {session && (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground" : isMatch ? "bg-warning" : "bg-primary",
                    )}
                  />
                )}
                {wasAttended && (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-accent",
                    )}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-primary" /> Entreno
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-warning" /> Partido
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-accent" /> Asististe
        </span>
      </div>
    </div>
  );
}
