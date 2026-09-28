"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useTeam } from "@/hooks/useTeam";
import type { AudienceViewer } from "@/lib/audience";
import { isTeamCoach } from "@/lib/permissions";

/**
 * Quién mira, para el público dentro del club (2026-09-28): su equipo activo
 * (el que lo hace miembro del club, igual que useMyClubId) y si es entrenador
 * de él. La dirección se resuelve aparte por club (myAdminClubId). undefined
 * mientras carga.
 */
export function useAudienceViewer(): AudienceViewer | undefined {
  const { firebaseUser, profile } = useAuth();
  const { team, loading } = useTeam();
  if (profile === null || loading) return undefined;
  return {
    isDirector: false,
    activeTeam: team?.teamname ?? null,
    isCoachOfActive: Boolean(team && isTeamCoach(team, firebaseUser?.uid)),
  };
}
