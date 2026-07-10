"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

// Formato de fecha compartido con Android: "dd/MM/yyyy"
function toKey(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export default function CalendarPage() {
  const { profile } = useAuth();
  const { team, hasTeam, loading } = useTeam();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const daysByFecha = useMemo(() => {
    const map = new Map<string, NonNullable<typeof team>["trainingdays"][number]>();
    for (const td of team?.trainingdays ?? []) {
      if (td.fecha) map.set(td.fecha, td);
    }
    return map;
  }, [team]);

  const attended = useMemo(
    () => new Set(profile?.assistedTrainingDays ?? []),
    [profile],
  );

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!hasTeam || team === null) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <EmptyState
          emoji="📅"
          title="Sin calendario de equipo"
          hint="Únete a un equipo desde la app Android para ver sus entrenos."
        />
      </div>
    );
  }

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=domingo → columna 6; 1=lunes → columna 0
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
    setSelected(null);
  };

  const selectedDay = selected ? daysByFecha.get(selected) : null;
  const myName = profile?.nameSurname ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Calendario</h1>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="size-10" aria-label="Mes anterior" onClick={prevMonth}>←</Button>
        <p className="font-medium">{MONTHS[month]} {year}</p>
        <Button variant="outline" size="icon" className="size-10" aria-label="Mes siguiente" onClick={nextMonth}>→</Button>
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
          const hasTraining = daysByFecha.has(key);
          const wasAttended = attended.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(hasTraining ? key : null)}
              className={cn(
                "aspect-square rounded-md text-sm",
                hasTraining
                  ? "bg-primary font-semibold text-primary-foreground hover:bg-[#4F46E5]"
                  : "hover:bg-muted",
                wasAttended && "ring-2 ring-accent",
                selected === key && "outline-2 outline-offset-2 outline-ring",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        ■ día con entreno · anillo verde = asististe
      </p>

      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between text-lg">
              <span>{selectedDay.nameTrainingDay || selectedDay.training?.name || "Entreno"}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedDay.horaInicio}–{selectedDay.horaFin}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* El training viene EMBEBIDO en el TrainingDay */}
            {selectedDay.training?.name && (
              <p>
                Entreno:{" "}
                <Link
                  className="underline underline-offset-4"
                  href={`/trainings/detail?name=${encodeURIComponent(selectedDay.training.name)}`}
                >
                  {selectedDay.training.name}
                </Link>{" "}
                ({selectedDay.training.tiempoTotal ?? "?"} min)
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {selectedDay.accepted_players.includes(myName) && (
                <Badge className="bg-accent text-accent-foreground">
                  Confirmaste asistencia
                </Badge>
              )}
              {selectedDay.declined_players.includes(myName) && (
                <Badge variant="destructive">Rechazaste asistencia</Badge>
              )}
              <Badge variant="outline">
                ✓ {selectedDay.accepted_players.length} · ✗{" "}
                {selectedDay.declined_players.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Para confirmar asistencia usa la app Android (próximamente aquí).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
