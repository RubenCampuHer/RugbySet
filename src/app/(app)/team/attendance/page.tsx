"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Download, Flame, Lock, Users, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeam } from "@/hooks/useTeam";
import {
  ATTENDANCE_PRESET_LABELS,
  attendanceDetailForPlayer,
  attendanceSummaryByPlayer,
  presetRange,
  type AttendancePreset,
  type DateRange,
} from "@/lib/attendance";
import { downloadCsv, toCsv } from "@/lib/csv";
import { isAdmin } from "@/lib/permissions";

/** "yyyy-MM-dd" (formato nativo de <input type="date">) → Date en medianoche local — mismo criterio que parseKey/toKey (lib/calendar.ts), sin pasar por UTC. */
function parseDateInputLocal(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

const STATUS_LABEL: Record<"accepted" | "declined" | "none", string> = {
  accepted: "Asistió",
  declined: "No asistió",
  none: "Sin responder",
};

/**
 * Informe de asistencia del equipo — filtrable por periodo, coach/admin
 * solamente. Se calcula íntegramente sobre team.trainingdays (ya cargado en
 * tiempo real por useTeam), sin lecturas nuevas ni cambios de reglas RTDB:
 * la asistencia se guarda por nombre de jugador, no por uid.
 */
function TeamAttendance() {
  const params = useSearchParams();
  const teamParam = params.get("team");
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const { team, hasTeam, loading } = useTeam(teamParam ?? undefined);

  const [preset, setPreset] = useState<AttendancePreset | "custom">("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!hasTeam || team === null) {
    return <EmptyState icon={Users} title="Equipo no encontrado" />;
  }

  const isLiteralCoach = team.usercoach === firebaseUser?.uid;
  const canView = isLiteralCoach || isAdmin(profile);
  if (!canView) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo el entrenador"
        hint="La asistencia del equipo solo la puede ver el entrenador."
      />
    );
  }

  const range: DateRange =
    preset === "custom"
      ? { from: parseDateInputLocal(customFrom), to: parseDateInputLocal(customTo) }
      : presetRange(preset);

  const summary = [...attendanceSummaryByPlayer(team, range)].sort(
    (a, b) => a.rate - b.rate || a.name.localeCompare(b.name),
  );
  const hasSessions = (summary[0]?.total ?? 0) > 0;

  const exportCsv = () => {
    const rows: string[][] = [["Jugador", "Fecha", "Tipo", "Entreno", "Estado"]];
    for (const name of team.userplayers) {
      for (const d of attendanceDetailForPlayer(team, name, range)) {
        rows.push([
          name,
          d.fecha,
          d.eventType === "MATCH" ? "Partido" : "Entrenamiento",
          d.nameTrainingDay ?? "",
          STATUS_LABEL[d.status],
        ]);
      }
    }
    downloadCsv(`asistencia_${team.teamname}.csv`, toCsv(rows));
  };

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

      <PageHeader
        title="Asistencia"
        action={
          <Button
            variant="outline"
            size="icon"
            aria-label="Exportar CSV"
            disabled={!hasSessions}
            onClick={exportCsv}
          >
            <Download />
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Select
            value={preset}
            onValueChange={(v) => setPreset(v as AttendancePreset | "custom")}
          >
            <SelectTrigger className="w-full" aria-label="Periodo">
              <SelectValue>
                {preset === "custom" ? "Personalizado" : ATTENDANCE_PRESET_LABELS[preset]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ATTENDANCE_PRESET_LABELS) as AttendancePreset[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {ATTENDANCE_PRESET_LABELS[p]}
                </SelectItem>
              ))}
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="flex gap-2">
              <Input
                type="date"
                aria-label="Desde"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                type="date"
                aria-label="Hasta"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {summary.length === 0 ? (
        <EmptyState icon={Users} title="Sin jugadores" />
      ) : !hasSessions ? (
        <EmptyState
          icon={Users}
          title="Sin entrenos en este periodo"
          hint="Prueba con otro rango de fechas."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {summary.map((s) => {
              const detail = expanded === s.name ? attendanceDetailForPlayer(team, s.name, range) : [];
              return (
                <div key={s.name}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                  >
                    <AvatarInitials name={s.name} size="sm" />
                    <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.attended}/{s.total}
                    </span>
                    {s.streak > 0 && (
                      <span
                        className="flex shrink-0 items-center gap-0.5 text-xs text-warning"
                        title="Racha actual"
                      >
                        <Flame className="size-3" />
                        {s.streak}
                      </span>
                    )}
                    <Badge variant={s.rate < 70 ? "destructive" : "secondary"} className="shrink-0">
                      {s.rate}%
                    </Badge>
                    {expanded === s.name ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {expanded === s.name && (
                    <div className="space-y-1 bg-muted/30 px-3 pb-3">
                      {detail.map((d) => (
                        <div
                          key={d.fecha}
                          className="flex items-center justify-between gap-2 py-1 text-xs"
                        >
                          <span className="truncate text-muted-foreground">
                            {d.fecha}
                            {d.nameTrainingDay ? ` · ${d.nameTrainingDay}` : ""}
                          </span>
                          {d.status === "accepted" && (
                            <Check className="size-3.5 shrink-0 text-accent" />
                          )}
                          {d.status === "declined" && (
                            <X className="size-3.5 shrink-0 text-destructive" />
                          )}
                          {d.status === "none" && (
                            <span className="shrink-0 text-muted-foreground">—</span>
                          )}
                        </div>
                      ))}
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

export default function TeamAttendancePage() {
  return (
    <Suspense fallback={<ListRowsSkeleton />}>
      <TeamAttendance />
    </Suspense>
  );
}
