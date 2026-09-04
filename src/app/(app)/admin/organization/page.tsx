"use client";

import { Lock, Plus, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllClubs } from "@/hooks/useAllClubs";
import { useAllTeams, type NamedTeam } from "@/hooks/useAllTeams";
import { createClub, getClubByCode } from "@/lib/actions/club";
import { isAdmin } from "@/lib/permissions";
import type { Team } from "@/lib/types";

/**
 * "+ Nuevo club" para el ADMIN: elige un equipo YA existente (sin club
 * todavía) para que sea el fundador — createClub ya acepta uid/coachName
 * como parámetros libres, no atados a la sesión actual, así que no hace
 * falta ninguna acción nueva, solo esta UI. Idéntico al que vivía en el
 * antiguo /admin/clubs, solo movido aquí.
 */
function NewClubDialog({ availableTeams }: { availableTeams: NamedTeam[] }) {
  const [open, setOpen] = useState(false);
  const [teamname, setTeamname] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const chosen = availableTeams.find((t) => t.name === teamname);
    if (!chosen || !clubName.trim() || !clubCode.trim()) return;
    if (!chosen.team.usercoach) {
      toast.error("Ese equipo no tiene entrenador asignado, no puede fundar un club.");
      return;
    }
    setCreating(true);
    try {
      const existing = await getClubByCode(clubCode.trim());
      if (existing) {
        toast.error("Este código de club ya está en uso. Elige otro.");
        return;
      }
      await createClub({
        clubName: clubName.trim(),
        clubCode: clubCode.trim(),
        clubIconUrl: null,
        teamname: chosen.name,
        uid: chosen.team.usercoach,
      });
      toast.success(`Club "${clubName.trim()}" creado con ${chosen.name} como fundador`);
      setOpen(false);
      setTeamname("");
      setClubName("");
      setClubCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el club");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xl" className="w-full" />}>
        <Plus className="size-4" /> Nuevo club
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo club</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Equipo fundador</Label>
            <Select value={teamname} onValueChange={(v) => setTeamname(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue>{teamname || "Elegir equipo…"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map(({ name }) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableTeams.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay equipos sin club todavía.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-club-name">Nombre del club</Label>
            <Input id="new-club-name" value={clubName} onChange={(e) => setClubName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-club-code">Código de acceso</Label>
            <Input id="new-club-code" value={clubCode} onChange={(e) => setClubCode(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={creating || !teamname || !clubName.trim() || !clubCode.trim()}
            onClick={() => void create()}
          >
            {creating ? "Creando…" : "Crear club"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fila de equipo — igual en la lista independiente y anidada bajo un club. */
function TeamRow({ name, team }: { name: string; team: Team | undefined }) {
  return (
    <Link href={`/admin/teams/detail?name=${encodeURIComponent(name)}`}>
      <div className="flex items-center gap-3 py-2 pr-1 pl-1 hover:bg-muted/50 rounded-lg">
        <AvatarInitials name={name} src={team?.teamicon} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {team && (
            <p className="truncate text-xs text-muted-foreground">
              {team.userplayers.length} jugador{team.userplayers.length === 1 ? "" : "es"}
              {team.pendingplayers.length > 0 &&
                ` · ${team.pendingplayers.length} pendiente${team.pendingplayers.length === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
        {team?.category && <Badge variant="outline">{team.category}</Badge>}
      </div>
    </Link>
  );
}

/**
 * "Organización" — vista unificada del ADMIN, sustituye a los antiguos
 * /admin/teams + /admin/clubs (pedido explícito 2026-09-04: "unificar la
 * vista del admin de equipos y clubs"). Jerárquica en vez de dos listas
 * planas separadas: cada club con sus equipos anidados debajo (reflejando
 * la relación real, antes había que entrar equipo a equipo para saber a
 * qué club pertenecía cada uno) + una sección aparte para los equipos sin
 * club. Clicar un club o un equipo lleva a los mismos ClubManager/
 * TeamManager de siempre (viewingAsAdmin) — esto solo cambia cómo se
 * llega ahí, no la gestión en sí.
 */
export default function AdminOrganizationPage() {
  const { profile } = useAuth();
  const { teams, loading: loadingTeams } = useAllTeams();
  const { clubs, loading: loadingClubs } = useAllClubs();
  const [search, setSearch] = useState("");

  if (profile === null || loadingTeams || loadingClubs) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver equipos y clubes ajenos."
      />
    );
  }

  const teamsByName = new Map(teams.map(({ name, team }) => [name, team]));
  const independentTeams = teams.filter(({ team }) => !team.clubId);
  const availableForNewClub = independentTeams;

  const q = search.trim().toLowerCase();
  const filteredClubs = clubs.filter(({ club }) => {
    if (q === "") return true;
    if ((club.clubname ?? "").toLowerCase().includes(q)) return true;
    return club.teams.some((n) => n.toLowerCase().includes(q));
  });
  const filteredIndependent = independentTeams.filter(
    ({ name }) => q === "" || name.toLowerCase().includes(q),
  );
  const noResults = filteredClubs.length === 0 && filteredIndependent.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Organización" />
      <NewClubDialog availableTeams={availableForNewClub} />
      <SearchInput placeholder="Buscar equipo o club…" value={search} onChange={setSearch} />

      {noResults ? (
        <EmptyState icon={Shield} title="Sin resultados" />
      ) : (
        <>
          {filteredClubs.map(({ id, club }) => (
            <Card key={id}>
              <Link href={`/admin/clubs/detail?id=${encodeURIComponent(id)}`}>
                <CardContent className="flex items-center gap-3 border-b border-border py-3 hover:bg-muted/50">
                  <AvatarInitials name={club.clubname ?? id} src={club.clubicon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{club.clubname || id}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {club.teams.length} equipo{club.teams.length === 1 ? "" : "s"}
                      {Object.keys(club.pendingTeams).length > 0 &&
                        ` · ${Object.keys(club.pendingTeams).length} pendiente${Object.keys(club.pendingTeams).length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </CardContent>
              </Link>
              <CardContent className="divide-y divide-border py-1 pl-6">
                {club.teams.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">Sin equipos todavía.</p>
                ) : (
                  club.teams.map((name) => (
                    <TeamRow key={name} name={name} team={teamsByName.get(name)} />
                  ))
                )}
              </CardContent>
            </Card>
          ))}

          {filteredIndependent.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Users className="size-4" /> Equipos independientes
              </p>
              <Card>
                <CardContent className="divide-y divide-border p-0 px-3">
                  {filteredIndependent.map(({ name, team }) => (
                    <TeamRow key={name} name={name} team={team} />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
