"use client";

import { Lock, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAllTeams } from "@/hooks/useAllTeams";
import { isAdmin } from "@/lib/permissions";

/**
 * Listado global de equipos — solo ADMIN. Cada fila enlaza a
 * /admin/teams/detail?name=..., que reutiliza TeamManager (mismo cuerpo que
 * /team, con viewingAsAdmin) en vez de una pantalla nueva.
 */
export default function AdminTeamsPage() {
  const { profile } = useAuth();
  const { teams, loading } = useAllTeams();
  const [search, setSearch] = useState("");

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver todos los equipos."
      />
    );
  }

  const filtered = teams.filter(
    ({ name }) => search === "" || name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Todos los equipos" count={teams.length} />
      <SearchInput
        placeholder="Buscar equipo…"
        value={search}
        onChange={setSearch}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Sin resultados" />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ name, team }) => (
            <Link key={name} href={`/admin/teams/detail?name=${encodeURIComponent(name)}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 py-3">
                  <AvatarInitials name={name} src={team.teamicon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {team.userplayers.length} jugador{team.userplayers.length === 1 ? "" : "es"}
                      {team.pendingplayers.length > 0 &&
                        ` · ${team.pendingplayers.length} pendiente${team.pendingplayers.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {team.category && <Badge variant="outline">{team.category}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
