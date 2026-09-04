"use client";

import { onValue, ref } from "firebase/database";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListRowsSkeleton } from "@/components/skeletons";
import { useAllContent } from "@/hooks/useAllContent";
import { useAllTeams } from "@/hooks/useAllTeams";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { getRoleDisplayName, isAdmin } from "@/lib/permissions";
import { parseMapOr } from "@/lib/schemas/common";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { PublicProfile, Role } from "@/lib/types";

const RECENT_ACTIVITY_DAYS = 30;

/** "dd/MM/yyyy" (formato compartido con Android) → epoch ms, o null si no parsea. */
function parseFecha(fecha: string | null | undefined): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha ?? "");
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
}

function useAllProfiles() {
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  useEffect(() => {
    return onValue(
      ref(db, PATHS.PUBLIC_PROFILES),
      (snap) => setProfiles(parseMapOr(PublicProfileSchema, snap.val(), "publicProfiles")),
      () => setProfiles([]),
    );
  }, []);
  return { profiles: profiles ?? [], loading: profiles === null };
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * "Salud de datos" agregada — NO es telemetría de producto (no hay eventos
 * de sesión/uso real, ni Firebase Analytics en la web). Todo se calcula
 * client-side a partir de nodos que ADMIN ya puede leer por reglas
 * (database.rules.json), sin Cloud Function ni coste de invocaciones.
 */
export default function AdminMetricsPage() {
  const { profile } = useAuth();
  const { profiles, loading: loadingProfiles } = useAllProfiles();
  const { teams, loading: loadingTeams } = useAllTeams();
  const { exercises, trainings, loading: loadingContent } = useAllContent();

  const loading = loadingProfiles || loadingTeams || loadingContent;

  // Igual que calendar/page.tsx: calculado en el cuerpo del render, no
  // dentro de un useMemo. new Date() (a diferencia de Date.now()) no lo
  // marca la regla react-hooks/purity — mismo patrón ya usado en esa página.
  const now = new Date().getTime();

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = { ADMIN: 0, COACH: 0, PLAYER: 0 };
    for (const p of profiles) {
      if (p.role) counts[p.role] += 1;
    }
    return counts;
  }, [profiles]);

  const teamStats = useMemo(() => {
    const cutoff = now - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
    let withoutPlayers = 0;
    let pendingBacklog = 0;
    let recentActivity = 0;
    for (const { team } of teams) {
      if (Object.keys(team.userplayers).length === 0) withoutPlayers++;
      pendingBacklog += Object.keys(team.pendingplayers).length;
      const hasRecent = team.trainingdays.some((d) => {
        const ms = parseFecha(d.fecha);
        return ms != null && ms >= cutoff && ms <= now;
      });
      if (hasRecent) recentActivity++;
    }
    return { withoutPlayers, pendingBacklog, recentActivity };
  }, [teams, now]);

  const contentStats = useMemo(() => {
    const byApproval = { PENDING: 0, APPROVED: 0, REJECTED: 0, legacy: 0 };
    const byPrivacy = { Privado: 0, Club: 0, Publico: 0, sin_dato: 0 };
    for (const item of [...exercises, ...trainings]) {
      if (item.approvalStatus === "PENDING") byApproval.PENDING++;
      else if (item.approvalStatus === "APPROVED") byApproval.APPROVED++;
      else if (item.approvalStatus === "REJECTED") byApproval.REJECTED++;
      else byApproval.legacy++;

      if (item.privacy === "Privado") byPrivacy.Privado++;
      else if (item.privacy === "Club") byPrivacy.Club++;
      else if (item.privacy === "Publico") byPrivacy.Publico++;
      else byPrivacy.sin_dato++;
    }
    return { byApproval, byPrivacy };
  }, [exercises, trainings]);

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver las métricas."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Métricas" />
      <p className="text-sm text-muted-foreground">
        Salud de datos agregada, calculada al vuelo — no es analítica de
        producto (no hay eventos de sesión ni Firebase Analytics todavía).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuarios ({profiles.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {(Object.keys(roleCounts) as Role[]).map((role) => (
            <StatRow key={role} label={getRoleDisplayName(role)} value={roleCounts[role]} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipos ({teams.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <StatRow
            label={`Con entreno en los últimos ${RECENT_ACTIVITY_DAYS} días`}
            value={teamStats.recentActivity}
          />
          <StatRow label="Sin jugadores" value={teamStats.withoutPlayers} />
          <StatRow label="Solicitudes pendientes (total)" value={teamStats.pendingBacklog} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Contenido ({exercises.length + trainings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <StatRow label="Ejercicios" value={exercises.length} />
          <StatRow label="Entrenos" value={trainings.length} />
          <StatRow label="Pendientes de aprobación" value={contentStats.byApproval.PENDING} />
          <StatRow label="Rechazados" value={contentStats.byApproval.REJECTED} />
          <StatRow label="Privados" value={contentStats.byPrivacy.Privado} />
          <StatRow label="De club" value={contentStats.byPrivacy.Club} />
          <StatRow label="Públicos" value={contentStats.byPrivacy.Publico} />
        </CardContent>
      </Card>
    </div>
  );
}
