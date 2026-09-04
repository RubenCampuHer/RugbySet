"use client";

import { Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { TeamManager } from "@/components/team/TeamManager";
import { TeamSkeleton } from "@/components/skeletons";
import { useClub } from "@/hooks/useClub";

// Detalle por query param (?name=), mismo patrón que /admin/teams/detail y
// /exercises/detail — las claves de Teams/{teamname} son nombres libres,
// incompatibles con rutas dinámicas en output: export.
//
// No hace falta comprobar aquí "¿ESTE equipo concreto es de mi club?" a
// mano: TeamManager usa useTeam(), cuyo onValue recibirá permission_denied
// de las reglas RTDB si el equipo pedido no pertenece a un club que
// administro, y useTeam ya trata ese error como "team: null" — que
// TeamManager muestra como "Equipo no encontrado" al ser un ?name= distinto
// de mi equipo activo (mismo comportamiento que /admin/teams/detail). Aquí
// solo filtramos el caso obvio: no administrar NINGÚN club. Los permisos
// los deriva TeamManager de la relación real (director del club de ESE
// equipo), sin flag de ruta (2026-09-04).
function ClubTeamDetail() {
  const params = useSearchParams();
  const name = params.get("name");
  const { club, loading } = useClub();

  if (loading) return <TeamSkeleton />;
  if (!club) {
    return (
      <EmptyState
        icon={Lock}
        title="No administras ningún club"
        hint="Solo el admin de un club puede gestionar sus equipos."
      />
    );
  }

  return <TeamManager teamname={name} />;
}

export default function ClubTeamDetailPage() {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <ClubTeamDetail />
    </Suspense>
  );
}
