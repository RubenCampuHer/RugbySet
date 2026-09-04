"use client";

import { Lock, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ClubManager } from "@/components/club/ClubManager";
import { EmptyState } from "@/components/EmptyState";
import { TeamSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { useClub } from "@/hooks/useClub";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import { isAdmin } from "@/lib/permissions";

// Detalle por query param (?id=): mismo patrón que /admin/teams/detail —
// reutiliza ClubManager (mismo cuerpo que /club) con viewingAsAdmin.
function AdminClubDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const { profile } = useAuth();
  const { club, loading } = useClub(id ?? undefined);
  const stuck = useLoadingTimeout(profile === null || loading);

  if (profile === null || loading) {
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
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para gestionar clubes ajenos."
      />
    );
  }
  if (!club) {
    return <EmptyState icon={Lock} title="Club no encontrado" />;
  }

  return <ClubManager club={club} viewingAsAdmin />;
}

export default function AdminClubDetailPage() {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <AdminClubDetail />
    </Suspense>
  );
}
