"use client";

import { Lock, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { ListRowsSkeleton } from "@/components/skeletons";
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
import { useAllTeams } from "@/hooks/useAllTeams";
import { createClub, getClubByCode } from "@/lib/actions/club";
import { isAdmin } from "@/lib/permissions";

/**
 * "+ Nuevo club" para el ADMIN: elige un equipo YA existente (sin club
 * todavía) para que sea el fundador — createClub ya acepta uid/coachName
 * como parámetros libres, no atados a la sesión actual, así que no hace
 * falta ninguna acción nueva, solo esta UI.
 */
function NewClubDialog() {
  const [open, setOpen] = useState(false);
  const { teams } = useAllTeams();
  const availableTeams = teams.filter(({ team }) => !team.clubId);
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

/**
 * Listado global de clubes — solo ADMIN. Cada fila enlaza a
 * /admin/clubs/detail?id=..., que reutiliza ClubManager (mismo cuerpo que
 * /club, con viewingAsAdmin) en vez de una pantalla nueva.
 */
export default function AdminClubsPage() {
  const { profile } = useAuth();
  const { clubs, loading } = useAllClubs();
  const [search, setSearch] = useState("");

  if (profile === null || loading) {
    return <ListRowsSkeleton />;
  }
  if (!isAdmin(profile)) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo administradores"
        hint="No tienes permisos para ver todos los clubes."
      />
    );
  }

  const filtered = clubs.filter(
    ({ club }) => search === "" || (club.clubname ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Todos los clubes" count={clubs.length} />
      <NewClubDialog />
      <SearchInput placeholder="Buscar club…" value={search} onChange={setSearch} />

      {filtered.length === 0 ? (
        <EmptyState icon={Shield} title="Sin resultados" />
      ) : (
        <div className="space-y-2">
          {filtered.map(({ id, club }) => (
            <Link key={id} href={`/admin/clubs/detail?id=${encodeURIComponent(id)}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 py-3">
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
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
