"use client";

import { Shield } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ClubManager } from "@/components/club/ClubManager";
import { ClubMembershipCard } from "@/components/club/ClubMembershipCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TeamSkeleton } from "@/components/skeletons";
import { useClub } from "@/hooks/useClub";
import { useTeam } from "@/hooks/useTeam";
import { isTeamCoach } from "@/lib/permissions";

/**
 * "Mi club": si administras un club (Clubs.adminUserId === tu uid) ves su
 * gestión completa (ClubManager); si eres coach de un equipo, ves el estado
 * de afiliación de tu propio equipo (ClubMembershipCard) — ambas secciones
 * son independientes, un admin de club también puede tener su propio equipo
 * afiliado a él o a otro distinto.
 */
export default function ClubPage() {
  const { firebaseUser, profile } = useAuth();
  const { club, loading: loadingClub } = useClub();
  const { team, hasTeam, loading: loadingTeam } = useTeam();

  if (profile === null || loadingClub || loadingTeam) {
    return <TeamSkeleton />;
  }

  const isCoachOfOwnTeam = Boolean(team && isTeamCoach(team, firebaseUser?.uid));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Club" />

      {club && <ClubManager club={club} />}

      {isCoachOfOwnTeam && hasTeam && team && (
        <ClubMembershipCard team={team} uid={profile.userId!} />
      )}

      {!club && !isCoachOfOwnTeam && (
        <EmptyState
          icon={Shield}
          title="Nada que ver aquí todavía"
          hint="La gestión de club es cosa del entrenador de un equipo: crea uno o une tu equipo a un club existente desde el equipo."
        />
      )}
    </div>
  );
}
