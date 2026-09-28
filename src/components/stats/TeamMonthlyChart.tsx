"use client";

import { ChartColumn } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { attendanceByMonth } from "@/lib/attendance";
import { MONTHS } from "@/lib/calendar";
import type { MonthlyPoint } from "@/lib/club-stats";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

const MAX_MONTHS = 12;
const TICKS = [100, 50, 0];

/** Año bajo el primer mes y bajo cada enero, solo si la serie cruza años (el mes solo no cabe con el año al lado). */
function yearMark(m: MonthlyPoint, i: number, spansYears: boolean): string {
  return spansYears && (i === 0 || m.month === 0) ? String(m.year) : "";
}

function sessionsLabel(n: number): string {
  return `${n} ${n === 1 ? "sesión" : "sesiones"}`;
}

/**
 * Barras de % por mes (2026-09-28). Una sola serie: sin leyenda, el título
 * dice qué se pinta; el valor de cada mes sale al pasar el ratón o tocar la
 * barra y en la tabla para lectores de pantalla. Con menos de 2 meses no se
 * pinta (no hay evolución que enseñar).
 */
export function MonthlyBarChart({
  series,
  title,
  subtitle,
  caption,
}: {
  series: MonthlyPoint[];
  title: string;
  subtitle: string;
  /** Título de la tabla para lectores de pantalla. */
  caption: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  if (series.length < 2) return null;

  const spansYears = series[0].year !== series[series.length - 1].year;
  const last = series[series.length - 1];
  const shown = series.find((m) => m.key === active) ?? null;
  const current = shown ?? last;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ChartColumn className="size-4" /> {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {/* Valor del mes activo (o del último) encima del gráfico: nunca tapa las barras. */}
        <p className="mb-3 text-sm" aria-live="polite">
          <span className="font-semibold">
            {MONTHS[current.month]} {current.year}: {current.value}%
          </span>
          <span className="text-muted-foreground"> · {sessionsLabel(current.sessions)}</span>
        </p>

        <div className="grid grid-cols-[2rem_1fr] gap-x-2" aria-hidden="true">
          {/* Eje Y: 0 / 50 / 100 con líneas guía finas. */}
          <div className="relative h-40">
            {TICKS.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                style={{ top: `${100 - t}%` }}
              >
                {t}%
              </span>
            ))}
          </div>
          <div className="relative h-40">
            {TICKS.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border" style={{ top: `${100 - t}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-0.5">
              {series.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  tabIndex={-1}
                  // Hover solo con ratón: en táctil el toque dispara enter + click y se anularían.
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(m.key)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
                  onClick={() => setActive(active === m.key ? null : m.key)}
                  className="flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  <span
                    className={cn(
                      "block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity",
                      shown && shown.key !== m.key && "opacity-40",
                    )}
                    // Un 0 % se ve como una raya en la base, no como un hueco.
                    style={{ height: `${Math.max(m.value, 1)}%` }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div />
          <div className="mt-1 flex gap-0.5">
            {series.map((m, i) => (
              <span
                key={m.key}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center text-[10px] leading-tight text-muted-foreground",
                  shown?.key === m.key && "font-medium text-foreground",
                )}
              >
                <span>{MONTHS[m.month].slice(0, 3)}</span>
                <span className="min-h-[1.25em] tabular-nums">{yearMark(m, i, spansYears)}</span>
              </span>
            ))}
          </div>
        </div>

        <table className="sr-only">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Asistencia</th>
              <th scope="col">Sesiones</th>
            </tr>
          </thead>
          <tbody>
            {series.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  {MONTHS[m.month]} {m.year}
                </th>
                <td>{m.value}%</td>
                <td>{m.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/**
 * Evolución por mes de la asistencia del equipo (2026-09-28, cuerpo técnico y
 * dirección del club): % medio de los jugadores en cada mes de la temporada,
 * mismo criterio que la media de AttendanceComparisonCard (marca real si se
 * pasó lista, si no la respuesta; cancelados, lesionados y justificados fuera).
 */
export function TeamMonthlyChart({ team }: { team: Team }) {
  const series = useMemo(
    () =>
      attendanceByMonth(team, null, {})
        .slice(-MAX_MONTHS)
        .map((m) => ({ key: m.key, year: m.year, month: m.month, value: m.teamAverage, sessions: m.sessions })),
    [team],
  );
  return (
    <MonthlyBarChart
      series={series}
      title="Evolución por mes"
      subtitle="Asistencia media del equipo en cada mes. Los eventos cancelados no cuentan."
      caption="Asistencia media del equipo por mes"
    />
  );
}
