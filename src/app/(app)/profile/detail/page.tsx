"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AvatarInitials } from "@/components/AvatarInitials";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClub } from "@/hooks/useClub";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { getRoleDisplayName } from "@/lib/permissions";

const TEAM_ROLE_LABEL: Record<"player" | "coach", string> = {
  player: "Jugador",
  coach: "Entrenador",
};

/**
 * Ficha de una persona por uid (2026-09-09) — foto, nombre, @usuario, rol
 * global, y TODOS sus equipos con su rol en cada uno + el club que dirige
 * (si alguno). Espejo de `ReadUserExternal` en Android: mismos campos de
 * `publicProfiles/{uid}` (teams, directorOfClubId), sin gate de ADMIN —
 * cualquier autenticado puede abrir la ficha de cualquiera, igual que ya
 * podía ver su nombre/foto vía `publicProfiles` (regla `auth != null`).
 * Se llega aquí desde cualquier fila de persona: equipo, club, admin,
 * pasar lista — ver los `<Link href="/profile/detail?uid=...">` en
 * TeamManager/ClubManager/admin/users/RollCall.
 */
function PersonDetail() {
  const params = useSearchParams();
  const uid = params.get("uid");
  const profiles = useProfilesByUid(uid ? [uid] : []);
  const profile = uid ? profiles[uid] : null;
  const { club } = useClub(profile?.directorOfClubId ?? null);

  if (!uid) {
    return <EmptyState icon={Lock} title="Persona no encontrada" />;
  }
  if (profile === undefined) {
    return <ListRowsSkeleton rows={2} />;
  }
  if (profile === null) {
    return (
      <EmptyState
        icon={Lock}
        title="Persona no encontrada"
        hint="Puede que la cuenta ya no exista."
      />
    );
  }

  const teamEntries = Object.entries(profile.teams);
  const hasNothingToShow = teamEntries.length === 0 && !profile.directorOfClubId;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/team" label="Equipo" />

      <div className="flex items-center gap-4">
        <AvatarInitials name={profile.nameSurname} src={profile.usericon} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            {profile.nameSurname || profile.username || "Jugador"}
          </h1>
          {profile.username && (
            <p className="truncate text-muted-foreground">@{profile.username}</p>
          )}
        </div>
        <Badge variant="outline">{getRoleDisplayName(profile.role)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hasNothingToShow ? (
            <p className="text-sm text-muted-foreground">No pertenece a ningún equipo todavía.</p>
          ) : (
            <>
              {teamEntries.map(([teamname, role]) => (
                <div key={teamname} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span className="truncate">{teamname}</span>
                  <Badge variant="outline">{TEAM_ROLE_LABEL[role]}</Badge>
                </div>
              ))}
              {profile.directorOfClubId && (
                <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Director de {club?.clubname ?? "un club"}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfileDetailPage() {
  return (
    <Suspense fallback={<ListRowsSkeleton rows={2} />}>
      <PersonDetail />
    </Suspense>
  );
}
