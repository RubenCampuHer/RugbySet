"use client";

import { get, onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { TeamSchema } from "@/lib/schemas/team";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { PublicProfile, Team } from "@/lib/types";

/**
 * Equipo del usuario actual (vía Users/{yo}/teamname) en tiempo real, y el
 * perfil público del coach (publicProfiles/{usercoach} — NUNCA Users/{uid},
 * las reglas solo permiten leer el nodo propio).
 *
 * Un `teamname` explícito (panel admin, ver un equipo ajeno) sustituye al
 * del perfil propio — las reglas RTDB ya dan lectura de cualquier equipo a
 * ADMIN, así que no hace falta ningún cambio de reglas para esto.
 */
export function useTeam(teamname?: string) {
  const { profile } = useAuth();
  const resolvedTeamname = teamname ?? profile?.teamname ?? null;
  const [teamState, setTeamState] = useState<{ name: string; team: Team | null } | undefined>(undefined);
  const [coach, setCoach] = useState<PublicProfile | null>(null);

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

  const coachUid = team && team !== undefined ? team.usercoach : null;
  useEffect(() => {
    if (!coachUid) return;
    void get(ref(db, `${PATHS.PUBLIC_PROFILES}/${coachUid}`)).then(
      (snap) =>
        setCoach(
          snap.exists()
            ? parseOr(PublicProfileSchema, snap.val(), `publicProfiles/${coachUid}`)
            : null,
        ),
      () => setCoach(null),
    );
  }, [coachUid]);

  // team: undefined = cargando, null = sin equipo, Team = cargado
  const loading = profile === null || team === undefined;
  return { team: team ?? null, coach, hasTeam: Boolean(resolvedTeamname), loading };
}
