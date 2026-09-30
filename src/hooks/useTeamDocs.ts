"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClub } from "@/hooks/useClub";
import { useTeam } from "@/hooks/useTeam";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { canEditTeamDocs, canReadStaffDocs, canReadTeamDocs } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { type TeamDocSpace, type TeamDocsSpaceData, TeamDocsSpaceSchema } from "@/lib/schemas/team-docs";
import { mergeSpaces, type MergedDocs } from "@/lib/team-docs";

type SpaceState = { key: string; data: TeamDocsSpaceData | null };

function useSpace(teamname: string | null, space: TeamDocSpace, enabled: boolean): TeamDocsSpaceData | null | undefined {
  const [state, setState] = useState<SpaceState | null>(null);
  const key = `${teamname}/${space}`;
  useEffect(() => {
    if (!teamname || !enabled) return;
    return onValue(
      ref(db, `${PATHS.TEAM_DOCS}/${teamname}/${space}`),
      (snap) => setState({ key, data: snap.exists() ? parseOr(TeamDocsSpaceSchema, snap.val(), `TeamDocs/${key}`) : null }),
      () => setState({ key, data: null }),
    );
  }, [teamname, space, enabled, key]);
  if (!teamname || !enabled) return null;
  return state?.key === key ? state.data : undefined;
}

/**
 * Equipo (el de ?team= o el activo) y qué puede hacer el usuario con sus
 * documentos (2026-09-30), con el mismo criterio que las reglas de TeamDocs.
 */
export function useTeamDocsAccess(teamParam: string | null) {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const { team, hasTeam, loading } = useTeam(teamParam ?? undefined);
  const { club, loading: loadingClub } = useClub(team?.clubId ?? null);
  const isDirector = Boolean(club && uid && (club.adminUserId === uid || club.directors[uid] === true));
  return {
    uid,
    team,
    hasTeam,
    canRead: Boolean(team && canReadTeamDocs(team, uid, profile, isDirector)),
    canSeeStaff: Boolean(team && canReadStaffDocs(team, uid, profile, isDirector)),
    canEdit: Boolean(team && canEditTeamDocs(team, uid, profile)),
    loading: loading || profile === null || (Boolean(team?.clubId) && loadingClub),
  };
}

/**
 * Documentos del equipo en tiempo real. El espacio del cuerpo técnico solo se
 * escucha si `withStaff` (las reglas no dejan leerlo a un jugador).
 */
export function useTeamDocs(
  teamname: string | null,
  withTeam: boolean,
  withStaff: boolean,
): { docs: MergedDocs; loading: boolean } {
  const team = useSpace(teamname, "team", withTeam);
  const staff = useSpace(teamname, "staff", withStaff);
  const docs = useMemo(() => mergeSpaces(team ?? null, staff ?? null), [team, staff]);
  return { docs, loading: team === undefined || staff === undefined };
}
