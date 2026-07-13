"use client";

import { Check, Copy, LogOut, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TeamSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/hooks/useTeam";
import {
  acceptPendingPlayer,
  joinTeamByCode,
  leaveTeam,
  rejectPendingPlayer,
  removePlayer,
} from "@/lib/actions/team";
import type { Team } from "@/lib/types";

/**
 * Formulario de ingreso por código para quien todavía no tiene equipo.
 * Usa la Cloud Function joinTeamByCode (dryRun para previsualizar, luego la
 * solicitud real) — las reglas no permiten a un no-miembro leer /Teams ni
 * escribir pendingplayers de forma segura desde el cliente.
 */
function JoinTeamForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ teamname: string; teamicon: string | null } | null>(null);

  const search = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setPreview(null);
    try {
      const result = await joinTeamByCode(trimmed, true);
      if (!result.found) {
        toast.error("Código no encontrado");
        return;
      }
      setPreview({ teamname: result.teamname!, teamicon: result.teamicon ?? null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al buscar el equipo");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    try {
      const result = await joinTeamByCode(code.trim(), false);
      if (!result.found) {
        toast.error("Código no encontrado");
        return;
      }
      const message =
        result.status === "joined"
          ? `Te has unido a ${result.teamname}`
          : result.status === "already_member"
            ? `Ya eres miembro de ${result.teamname}`
            : `Solicitud enviada a ${result.teamname}. Tu entrenador debe aceptarte.`;
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-lg border p-4">
      <div className="flex gap-2">
        <Input
          value={code}
          placeholder="Código del equipo"
          onChange={(e) => { setCode(e.target.value); setPreview(null); }}
          onKeyDown={(e) => e.key === "Enter" && void search()}
        />
        <Button variant="outline" disabled={busy || !code.trim()} onClick={() => void search()}>
          Buscar
        </Button>
      </div>
      {preview && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-3">
          <div className="flex items-center gap-2">
            <AvatarInitials name={preview.teamname} src={preview.teamicon} size="sm" />
            <span className="text-sm font-medium">{preview.teamname}</span>
          </div>
          <Button size="sm" disabled={busy} onClick={() => void join()}>
            Solicitar ingreso
          </Button>
        </div>
      )}
    </div>
  );
}

/** Fila de jugador en la lista del equipo — objetivo táctil 44px en las acciones. */
function PlayerRow({
  name,
  action,
}: {
  name: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg py-2 pr-1 pl-2 hover:bg-muted/50">
      <AvatarInitials name={name} size="sm" />
      <span className="flex-1 truncate text-sm">{name}</span>
      {action}
    </div>
  );
}

// Gestión visible solo para el coach — mismo discriminador que Android
// (ReadTeam: usercoach == uid), no el rol.
function PendingSection({ team, isCoach }: { team: Team; isCoach: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (team.pendingplayers.length === 0) return null;

  const act = async (name: string, accept: boolean) => {
    setBusy(name);
    try {
      if (accept) {
        await acceptPendingPlayer(team, name);
        toast.success(`${name} aceptado en el equipo`);
      } else {
        await rejectPendingPlayer(team, name);
        toast.success(`Solicitud de ${name} rechazada`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Solicitudes pendientes ({team.pendingplayers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {team.pendingplayers.map((name) => (
          <PlayerRow
            key={name}
            name={name}
            action={
              isCoach ? (
                <span className="flex gap-1">
                  <Button
                    size="icon-xl"
                    className="rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                    aria-label={`Aceptar a ${name}`}
                    disabled={busy === name}
                    onClick={() => void act(name, true)}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon-xl"
                    variant="destructive"
                    className="rounded-full"
                    aria-label={`Rechazar a ${name}`}
                    disabled={busy === name}
                    onClick={() => void act(name, false)}
                  >
                    <X className="size-4" />
                  </Button>
                </span>
              ) : undefined
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default function TeamPage() {
  const { firebaseUser } = useAuth();
  const { team, coach, hasTeam, loading } = useTeam();
  const [kicking, setKicking] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (loading) {
    return <TeamSkeleton />;
  }
  if (!hasTeam || team === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Equipo" />
        <EmptyState
          icon={Users}
          title="No perteneces a ningún equipo"
          hint="Introduce el código que te haya dado tu entrenador."
        />
        <JoinTeamForm />
      </div>
    );
  }

  const isCoach = team.usercoach === firebaseUser?.uid;

  const kick = async (name: string) => {
    setKicking(name);
    try {
      await removePlayer(team, name);
      toast.success(`${name} expulsado del equipo`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo expulsar");
    } finally {
      setKicking(null);
    }
  };

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveTeam();
      toast.success("Has salido del equipo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo salir del equipo");
    } finally {
      setLeaving(false);
    }
  };

  const copyCode = async () => {
    if (!team.teamcode) return;
    try {
      await navigator.clipboard.writeText(team.teamcode);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <AvatarInitials name={team.teamname} src={team.teamicon} className="size-16" fallbackClassName="text-lg" />
        <div>
          <h1 className="text-2xl font-bold">{team.teamname}</h1>
          <div className="flex flex-wrap items-center gap-1">
            {team.category && <Badge variant="outline">{team.category}</Badge>}
            {team.teamcode && (
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex min-h-8 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Copiar código de equipo"
              >
                Código: {team.teamcode}
                <Copy className="size-3" />
              </button>
            )}
            {isCoach && (
              <Badge className="border-transparent bg-primary/15 text-brand">
                Eres el entrenador
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entrenador</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <AvatarInitials name={coach?.nameSurname} src={coach?.usericon} />
          <div>
            <p className="font-medium">{coach?.nameSurname ?? "Entrenador"}</p>
            {coach?.username && (
              <p className="text-sm text-muted-foreground">@{coach.username}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <PendingSection team={team} isCoach={isCoach} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Jugadores ({team.userplayers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {team.userplayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin jugadores.</p>
          ) : (
            team.userplayers.map((name) => (
              <PlayerRow
                key={name}
                name={name}
                action={
                  isCoach ? (
                    <ConfirmDialog
                      trigger={
                        <Button
                          size="icon-xl"
                          variant="ghost"
                          className="rounded-full text-destructive hover:text-destructive"
                          aria-label={`Expulsar a ${name}`}
                          disabled={kicking === name}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={`¿Expulsar a ${name}?`}
                      description="Perderá el acceso al equipo y su historial de asistencia."
                      confirmLabel="Expulsar"
                      destructive
                      onConfirm={() => kick(name)}
                    />
                  ) : undefined
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {!isCoach && (
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              disabled={leaving}
            >
              <LogOut className="size-4" /> Salir del equipo
            </Button>
          }
          title={`¿Salir de ${team.teamname}?`}
          description="Tendrás que volver a unirte con el código del equipo si cambias de opinión."
          confirmLabel="Salir del equipo"
          destructive
          onConfirm={leave}
        />
      )}
    </div>
  );
}
