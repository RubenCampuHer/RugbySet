"use client";

import { Shield } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { playerMatchStats } from "@/lib/match-stats";
import type { Team } from "@/lib/types";

/**
 * Partidos del jugador en un equipo (2026-10-01): convocado, jugados y como
 * titular, de convocatoria + alineación + pasar lista. Nada si el equipo aún
 * no tiene partidos pasados.
 */
export function MatchStatsCard({ team, uid, title = "Tus partidos" }: { team: Team; uid: string; title?: string }) {
  const stats = useMemo(() => playerMatchStats(team, uid), [team, uid]);
  if (stats.matches === 0) return null;

  const cells = [
    { value: stats.called, label: "Convocado" },
    { value: stats.played, label: "Jugados" },
    { value: stats.started, label: "Titular" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg bg-muted/50 p-2">
              <p className="text-2xl font-bold leading-none tabular-nums">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          De {stats.matches} {stats.matches === 1 ? "partido" : "partidos"} de {team.teamname}. Sale de la
          convocatoria, la alineación y la lista de cada partido; los cancelados y suspendidos no cuentan.
        </p>
      </CardContent>
    </Card>
  );
}
