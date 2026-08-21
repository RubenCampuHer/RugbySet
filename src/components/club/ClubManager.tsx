"use client";

import { get, ref } from "firebase/database";
import { Check, ShieldCheck, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveTeamJoin,
  rejectTeamJoin,
  removeTeamFromClub,
} from "@/lib/actions/club";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { TeamSchema } from "@/lib/schemas/team";
import type { Club, Team } from "@/lib/types";

/** Ficha ligera de cada equipo del club — lectura puntual, no en tiempo real (la lista completa se refresca al aceptar/rechazar/quitar). */
function useTeamsPreview(names: string[]) {
  const [teams, setTeams] = useState<Record<string, Team | null>>({});
  const key = names.join("|");

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      names.map(async (name) => {
        try {
          const snap = await get(ref(db, `${PATHS.TEAMS}/${name}`));
          return [name, snap.exists() ? parseOr(TeamSchema, snap.val(), `Teams/${name}`) : null] as const;
        } catch {
          // Equipo que ya salió del club (referencia colgante) — sin acceso.
          return [name, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setTeams(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` representa `names` de forma estable
  }, [key]);

  return teams;
}

/**
 * Panel completo del admin del club: solicitudes pendientes + roster de
 * equipos. `club` viene de useClub() (onValue en tiempo real) — no hace
 * falta refrescar a mano tras aceptar/rechazar/quitar.
 */
export function ClubManager({ club }: { club: Club }) {
  const [busy, setBusy] = useState<string | null>(null);
  const teamsPreview = useTeamsPreview(club.teams);

  const decide = async (teamname: string, accept: boolean) => {
    setBusy(teamname);
    try {
      if (accept) {
        await approveTeamJoin(club, teamname);
        toast.success(`${teamname} aceptado en el club`);
      } else {
        await rejectTeamJoin(club, teamname);
        toast.success(`Solicitud de ${teamname} rechazada`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (teamname: string) => {
    setBusy(teamname);
    try {
      await removeTeamFromClub(club, teamname);
      toast.success(`${teamname} ya no pertenece al club`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar del club");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <AvatarInitials name={club.clubname} src={club.clubicon} className="size-16" fallbackClassName="text-lg" />
        <div>
          <h1 className="text-2xl font-bold">{club.clubname}</h1>
          <div className="flex flex-wrap items-center gap-1">
            {club.clubcode && (
              <span className="text-sm text-muted-foreground">Código: {club.clubcode}</span>
            )}
            <Badge className="border-transparent bg-primary/15 text-brand">
              <ShieldCheck className="size-3" /> Eres el admin del club
            </Badge>
          </div>
        </div>
      </div>

      {Object.keys(club.pendingTeams).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Solicitudes pendientes ({Object.keys(club.pendingTeams).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {Object.keys(club.pendingTeams).map((name) => (
              <div key={name} className="flex items-center gap-3 rounded-lg py-2 pr-1 pl-2">
                <AvatarInitials name={name} size="sm" />
                <span className="flex-1 truncate text-sm">{name}</span>
                <span className="flex gap-1">
                  <Button
                    size="icon-xl"
                    className="rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                    aria-label={`Aceptar a ${name}`}
                    disabled={busy === name}
                    onClick={() => void decide(name, true)}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon-xl"
                    variant="destructive"
                    className="rounded-full"
                    aria-label={`Rechazar a ${name}`}
                    disabled={busy === name}
                    onClick={() => void decide(name, false)}
                  >
                    <X className="size-4" />
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipos ({club.teams.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {club.teams.length === 0 ? (
            <EmptyState icon={Users} title="Este club todavía no tiene equipos" />
          ) : (
            club.teams.map((name) => {
              const team = teamsPreview[name];
              return (
                <div key={name} className="flex items-center gap-3 py-2">
                  <Link
                    href={`/club/teams/detail?name=${encodeURIComponent(name)}`}
                    className="flex flex-1 items-center gap-3 truncate rounded-lg py-1 pr-1 pl-1 hover:bg-muted/50"
                  >
                    <AvatarInitials name={name} src={team?.teamicon} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      {team && (
                        <p className="truncate text-xs text-muted-foreground">
                          {team.userplayers.length} jugador{team.userplayers.length === 1 ? "" : "es"}
                          {team.category && ` · ${team.category}`}
                        </p>
                      )}
                    </div>
                  </Link>
                  <ConfirmDialog
                    trigger={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Quitar a ${name} del club`}
                        disabled={busy === name}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title={`¿Quitar a ${name} del club?`}
                    description="El equipo sigue existiendo, solo deja de pertenecer a este club."
                    confirmLabel="Quitar del club"
                    destructive
                    onConfirm={() => remove(name)}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
