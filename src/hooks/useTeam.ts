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
 */
export function useTeam() {
  const { profile } = useAuth();
  const teamname = profile?.teamname ?? null;
  const [teamState, setTeamState] = useState<{ name: string; team: Team | null } | undefined>(undefined);
  const [coach, setCoach] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (!teamname) return;
    const teamRef = ref(db, `${PATHS.TEAMS}/${teamname}`);
    return onValue(
      teamRef,
      (snap) =>
        setTeamState({
          name: teamname,
          team: snap.exists()
            ? parseOr(TeamSchema, snap.val(), `Teams/${teamname}`)
            : null,
        }),
      (error) => {
        console.error("useTeam:", error);
        setTeamState({ name: teamname, team: null });
      },
    );
  }, [teamname]);

  const team =
    !teamname ? null : teamState?.name === teamname ? teamState.team : undefined;

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
  return { team: team ?? null, coach, hasTeam: Boolean(teamname), loading };
}
