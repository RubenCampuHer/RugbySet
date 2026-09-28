"use client";

import { ChartNoAxesColumn, Lock, RefreshCw } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { ListRowsSkeleton } from "@/components/skeletons";
import { MonthlyBarChart } from "@/components/stats/TeamMonthlyChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLessonsClub } from "@/hooks/useClubLessons";
import { useClubStats } from "@/hooks/useClubStats";
import { clubMonthlySeries, clubSummary, teamRanking } from "@/lib/club-stats";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * El club en números (2026-09-28): asistencia y sesiones de cada equipo del
 * club, para la dirección y los entrenadores del club. Los datos los calcula
 * una Cloud Function (ClubStats): los entrenadores no pueden leer los otros
 * equipos.
 */
export default function ClubStatsPage() {
  const { uid, clubId, club, isDirector, canWrite, loading } = useLessonsClub();
  const clubTeams = club?.teams ?? [];
  const { stats, loading: loadingStats, refreshing, error } = useClubStats(clubId, clubTeams);

  if (loading || (clubId && loadingStats)) return <ListRowsSkeleton />;
  // canWrite = dirección o entrenador de su equipo activo del club (mismo criterio que la regla de ClubStats).
  if (!clubId || !uid || (!isDirector && !canWrite) || error) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo la dirección y los entrenadores del club"
        hint="Los números del club los ven su dirección y los entrenadores de sus equipos."
      />
    );
  }

  const summary = clubSummary(stats);
  const ranking = teamRanking(stats);
  const series = clubMonthlySeries(stats);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/club" label="Club" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ChartNoAxesColumn className="size-6" /> El club en números
        </h1>
        {refreshing && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" /> Actualizando…
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {club?.clubname}: asistencia media de los jugadores de cada equipo en toda la temporada. Una sesión cuenta desde el
        día siguiente; los eventos cancelados, lesionados y justificados no cuentan.
      </p>

      {ranking.length === 0 ? (
        <EmptyState icon={ChartNoAxesColumn} title="Todavía no hay datos" hint="Aparecerán en cuanto los equipos tengan sesiones." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Asistencia media" value={summary.rate == null ? "—" : `${summary.rate}%`} />
            <Tile label="Equipos" value={String(summary.teams)} />
            <Tile label="Jugadores" value={String(summary.players)} />
            <Tile label="Sesiones jugadas" value={String(summary.sessions)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Asistencia por equipo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ranking.map(({ team, stats: s }) => (
                <div key={team} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{team}</span>
                    <span className="shrink-0 tabular-nums">{s.rate == null ? "sin datos" : `${s.rate}%`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className={cn("h-full rounded-full bg-primary", s.rate == null && "bg-transparent")}
                      style={{ width: `${s.rate ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.players} {s.players === 1 ? "jugador" : "jugadores"} · {s.sessions}{" "}
                    {s.sessions === 1 ? "sesión" : "sesiones"}
                    {s.matches ? ` (${s.matches} ${s.matches === 1 ? "partido" : "partidos"})` : ""}
                    {s.lastSessionAt ? ` · última el ${dateFmt.format(new Date(s.lastSessionAt))}` : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <MonthlyBarChart
            series={series}
            title="Evolución del club"
            subtitle="Asistencia media de los equipos en cada mes."
            caption="Asistencia media del club por mes"
          />
        </>
      )}
    </div>
  );
}
