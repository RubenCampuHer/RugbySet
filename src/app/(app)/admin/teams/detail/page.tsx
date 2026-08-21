"use client";

import { Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { TeamManager } from "@/components/team/TeamManager";
import { TeamSkeleton } from "@/components/skeletons";
import { isAdmin } from "@/lib/permissions";

// Detalle por query param (?name=): las claves de Teams/{teamname} son
// nombres libres, incompatibles con rutas dinámicas en output: export
// (mismo patrón que /exercises/detail y /trainings/detail).
function AdminTeamDetail() {
  const params = useSearchParams();
  const name = params.get("name");
  const { profile } = useAuth();

  if (profile === null) {
    return <TeamSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para gestionar equipos ajenos."
      />
    );
  }

  return <TeamManager teamname={name} viewingAsAdmin />;
}

export default function AdminTeamDetailPage() {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <AdminTeamDetail />
    </Suspense>
  );
}
