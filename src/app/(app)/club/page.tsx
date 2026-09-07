"use client";

import { Shield, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { ClubManager } from "@/components/club/ClubManager";
import { ClubMembershipCard } from "@/components/club/ClubMembershipCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TeamSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { useClub } from "@/hooks/useClub";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import { useTeam } from "@/hooks/useTeam";
import { isTeamCoach } from "@/lib/permissions";

/**
 * "Club": si administras un club (Clubs.adminUserId === tu uid) ves su
 * gestión completa (ClubManager); si eres coach de un equipo, ves el estado
 * de afiliación de tu propio equipo (ClubMembershipCard) — ambas secciones
 * son independientes, un admin de club también puede tener su propio equipo
 * afiliado a él o a otro distinto.
 */
export default function ClubPage() {
  const { firebaseUser, profile } = useAuth();
  const { club, loading: loadingClub } = useClub();
  const { team, hasTeam, loading: loadingTeam } = useTeam();
  const stuck = useLoadingTimeout(profile === null || loadingClub || loadingTeam);

  if (profile === null || loadingClub || loadingTeam) {
    if (stuck) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Tarda más de lo normal"
          hint="Puede ser un problema de conexión — vuelve a intentarlo."
          action={<Button onClick={() => location.reload()}>Reintentar</Button>}
        />
      );
    }
    return <TeamSkeleton />;
  }

  const isCoachOfOwnTeam = Boolean(team && isTeamCoach(team, firebaseUser?.uid));
  // 2026-09-07: un jugador cuyo equipo está en un club también ve aquí la
  // tarjeta informativa "tu equipo forma parte del club X" (antes: estado
  // vacío engañoso). Sin club, solo el coach tiene algo que hacer (unirse/crear).
  const showMembership = Boolean(hasTeam && team && (isCoachOfOwnTeam || team.clubId));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Club" />

      {club && <ClubManager club={club} />}

      {showMembership && team && (
        <ClubMembershipCard team={team} uid={profile.userId!} isCoach={isCoachOfOwnTeam} />
      )}

      {!club && !showMembership && (
        <EmptyState
          icon={Shield}
          title="Nada que ver aquí todavía"
          hint="Tu equipo no forma parte de ningún club. Unirse a uno o crearlo es cosa del entrenador del equipo."
          action={
            <Link href="/team" className={buttonVariants({ variant: "outline" })}>
              Ir a mi equipo
            </Link>
          }
        />
      )}
    </div>
  );
}
