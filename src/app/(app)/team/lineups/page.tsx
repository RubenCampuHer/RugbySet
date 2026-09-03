"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Lock, Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { LineupSummary } from "@/components/calendar/LineupSummary";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { useTeam } from "@/hooks/useTeam";
import { parseKey } from "@/lib/calendar";
import { isAdmin } from "@/lib/permissions";
import type { TrainingDay } from "@/lib/types";

/**
 * Alineaciones publicadas del equipo — vista agregada (mirror del patrón de
 * /team/attendance): un partido por fila, con la alineación completa
 * desplegable. Solo lista partidos con lineup.published === true, mismo
 * criterio de visibilidad que ya usa DayPanel para el jugador (un borrador
 * solo lo ve quien lo edita, en su propia pestaña de coach). A diferencia
 * de /team/attendance, aquí puede entrar CUALQUIER miembro del equipo, no
 * solo el entrenador — una alineación publicada es información para todos.
 */
function TeamLineups() {
  const params = useSearchParams();
  const teamParam = params.get("team");
  const router = useRouter();
  const { profile } = useAuth();
  const { team, hasTeam, loading } = useTeam(teamParam ?? undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!hasTeam || team === null) {
    return <EmptyState icon={Trophy} title="Equipo no encontrado" />;
  }

  const isMember = profile.teamname === team.teamname;
  const canView = isMember || isAdmin(profile);
  if (!canView) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo el equipo"
        hint="Las alineaciones solo las pueden ver los miembros de este equipo."
      />
    );
  }

  const matches = team.trainingdays
    .filter((d): d is TrainingDay & { fecha: string } =>
      d.eventType === "MATCH" && Boolean(d.lineup?.published) && d.fecha != null,
    )
    .map((d) => ({ day: d, ms: parseKey(d.fecha)?.getTime() ?? 0 }))
    .sort((a, b) => b.ms - a.ms) // más reciente primero
    .map(({ day }) => day);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-4" />
        Volver
      </button>

      <PageHeader title="Alineaciones" />

      {matches.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sin alineaciones publicadas"
          hint="Aquí aparecerán los partidos en cuanto el entrenador publique su alineación."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {matches.map((day) => {
              const key = day.fecha!;
              const isExpanded = expanded === key;
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : key)}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  >
                    <span className="flex-1 truncate text-sm font-medium">
                      {day.nameTrainingDay || "Partido"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{day.fecha}</span>
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {isExpanded && day.lineup && (
                    <div className="bg-muted/30 px-3 pb-3">
                      <LineupSummary lineup={day.lineup} />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TeamLineupsPage() {
  return (
    <Suspense fallback={<ListRowsSkeleton />}>
      <TeamLineups />
    </Suspense>
  );
}
