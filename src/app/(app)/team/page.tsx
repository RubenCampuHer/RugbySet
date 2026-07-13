"use client";

import { Check, LogOut, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
            <Avatar className="size-8">
              <AvatarImage src={preview.teamicon ?? undefined} />
              <AvatarFallback>🏉</AvatarFallback>
            </Avatar>
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

function PlayerChip({
  name,
  action,
}: {
  name: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-3 py-1">
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-sm">{name}</span>
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
      <CardContent className="flex flex-wrap gap-2">
        {team.pendingplayers.map((name) => (
          <PlayerChip
            key={name}
            name={name}
            action={
              isCoach ? (
                <span className="flex gap-1">
                  <Button
                    size="icon"
                    className="size-7 rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                    aria-label={`Aceptar a ${name}`}
                    disabled={busy === name}
                    onClick={() => void act(name, true)}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="size-7 rounded-full"
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
    return <Skeleton className="h-96 w-full" />;
  }
  if (!hasTeam || team === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Equipo</h1>
        <EmptyState
          emoji="👥"
          title="No perteneces a ningún equipo"
          hint="Introduce el código que te haya dado tu entrenador."
        />
        <JoinTeamForm />
      </div>
    );
  }

  const isCoach = team.usercoach === firebaseUser?.uid;

  const kick = async (name: string) => {
    if (!window.confirm(`¿Expulsar a ${name} del equipo?`)) return;
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
    if (!window.confirm(`¿Salir de ${team.teamname}?`)) return;
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={team.teamicon ?? undefined} />
          <AvatarFallback>🏉</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{team.teamname}</h1>
          <div className="flex flex-wrap gap-1">
            {team.category && <Badge variant="outline">{team.category}</Badge>}
            {team.teamcode && (
              <Badge variant="secondary">Código: {team.teamcode}</Badge>
            )}
            {isCoach && (
              <Badge className="border-transparent bg-primary/15 text-[#818CF8]">
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
          <Avatar>
            <AvatarImage src={coach?.usericon ?? undefined} />
            <AvatarFallback>
              {(coach?.nameSurname ?? "E").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
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
        <CardContent className="flex flex-wrap gap-2">
          {team.userplayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin jugadores.</p>
          ) : (
            team.userplayers.map((name) => (
              <PlayerChip
                key={name}
                name={name}
                action={
                  isCoach ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 rounded-full text-destructive hover:text-destructive"
                      aria-label={`Expulsar a ${name}`}
                      disabled={kicking === name}
                      onClick={() => void kick(name)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : undefined
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {!isCoach && (
        <Button
          variant="ghost"
          className="w-full text-destructive hover:text-destructive"
          disabled={leaving}
          onClick={() => void leave()}
        >
          <LogOut className="size-4" /> Salir del equipo
        </Button>
      )}
    </div>
  );
}
