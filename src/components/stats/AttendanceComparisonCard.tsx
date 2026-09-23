"use client";

import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  attendanceByMonth,
  presetRange,
  teamComparison,
  type AttendancePreset,
} from "@/lib/attendance";
import { MONTHS } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

const PRESETS: { value: AttendancePreset; label: string }[] = [
  { value: "month", label: "Este mes" },
  { value: "all", label: "Temporada" },
];

function message(mine: number, avg: number): string {
  if (mine >= avg + 10) return "Estás por encima de la media del equipo. Sigue así.";
  if (mine < 50) return "Estás por debajo de la mitad de los entrenos.";
  if (mine < avg) return "Estás algo por debajo de la media del equipo.";
  return "Estás en la media del equipo.";
}

function Bar({ value, className }: { value: number; className: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${value}%` }} />
    </div>
  );
}

/**
 * Asistencia del jugador frente a su equipo (2026-09-23): % propio, media,
 * posición y evolución mensual. Todo en cliente sobre el equipo activo, sin
 * nombres de compañeros.
 */
export function AttendanceComparisonCard({ team, uid }: { team: Team; uid: string }) {
  const [preset, setPreset] = useState<AttendancePreset>("all");
  const range = useMemo(() => presetRange(preset), [preset]);
  const cmp = useMemo(() => teamComparison(team, uid, range), [team, uid, range]);
  const months = useMemo(
    () => attendanceByMonth(team, uid, presetRange("all")).slice(-6),
    [team, uid],
  );

  if (!cmp) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" /> Tu asistencia
        </CardTitle>
        <Tabs value={preset} onValueChange={(v) => setPreset(v as AttendancePreset)}>
          <TabsList>
            {PRESETS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {cmp.sessions === 0 ? (
          <p className="text-muted-foreground">Todavía no hay entrenos pasados en este periodo.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-2xl font-bold leading-none">{cmp.mine}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Tú</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-2xl font-bold leading-none">{cmp.teamAverage}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Media del equipo</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-2xl font-bold leading-none">{cmp.rank}º</p>
                <p className="mt-1 text-xs text-muted-foreground">de {cmp.size}</p>
              </div>
            </div>
            <p>{message(cmp.mine, cmp.teamAverage)}</p>
            <p className="text-xs text-muted-foreground">
              Sobre {cmp.sessions} {cmp.sessions === 1 ? "sesión" : "sesiones"}. Los eventos
              cancelados no cuentan.
            </p>
          </>
        )}

        {months.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Por mes</p>
            {months.map((m) => (
              <div key={m.key} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
                <span className="text-xs">{MONTHS[m.month].slice(0, 3)}</span>
                <div className="space-y-1">
                  <Bar value={m.mine ?? 0} className="bg-primary" />
                  <Bar value={m.teamAverage} className="bg-muted-foreground/40" />
                </div>
                <span className="text-right text-xs tabular-nums">{m.mine}%</span>
              </div>
            ))}
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" /> Tú
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-muted-foreground/40" /> Media del equipo
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
