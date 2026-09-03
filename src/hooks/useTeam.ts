"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { TeamSchema } from "@/lib/schemas/team";
import type { Team } from "@/lib/types";

/**
 * Equipo del usuario actual (vía Users/{yo}/teamname) en tiempo real.
 *
 * Un `teamname` explícito (panel admin, ver un equipo ajeno) sustituye al
 * del perfil propio — las reglas RTDB ya dan lectura de cualquier equipo a
 * ADMIN, así que no hace falta ningún cambio de reglas para esto.
 *
 * Ya no resuelve el perfil del coach aquí (antes `coach`, un solo
 * usercoach) — desde el rediseño multi-coach 2026-09-03 quien necesita
 * mostrar entrenadores (fundador + co-entrenadores) resuelve sus perfiles
 * con useProfilesByUid, ver CoachesSection en TeamManager.
 */
export function useTeam(teamname?: string) {
  const { profile } = useAuth();
  const resolvedTeamname = teamname ?? profile?.teamname ?? null;
  const [teamState, setTeamState] = useState<{ name: string; team: Team | null } | undefined>(undefined);

  useEffect(() => {
    if (!resolvedTeamname) return;
    const teamRef = ref(db, `${PATHS.TEAMS}/${resolvedTeamname}`);
    return onValue(
      teamRef,
      (snap) =>
        setTeamState({
          name: resolvedTeamname,
          team: snap.exists()
            ? parseOr(TeamSchema, snap.val(), `Teams/${resolvedTeamname}`)
            : null,
        }),
      (error) => {
        console.error("useTeam:", error);
        setTeamState({ name: resolvedTeamname, team: null });
      },
    );
  }, [resolvedTeamname]);

  const team =
    !resolvedTeamname ? null : teamState?.name === resolvedTeamname ? teamState.team : undefined;

  // team: undefined = cargando, null = sin equipo, Team = cargado
  const loading = profile === null || team === undefined;
  return { team: team ?? null, hasTeam: Boolean(resolvedTeamname), loading };
}
