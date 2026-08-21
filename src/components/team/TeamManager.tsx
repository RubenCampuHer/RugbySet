"use client";

import { get, ref } from "firebase/database";
import { Camera, Check, Copy, Flame, LogOut, Megaphone, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TeamSkeleton } from "@/components/skeletons";
import { JoinTeamForm } from "@/components/team/JoinTeamForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTeam } from "@/hooks/useTeam";
import {
  acceptPendingPlayer,
  adminDeleteTeam,
  deleteTeam,
  leaveTeam,
  rejectPendingPlayer,
  removePlayer,
  resolveUidByName,
  updateTeamIcon,
} from "@/lib/actions/team";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { sendGeneralMessage } from "@/lib/actions/notify";
import { isAdmin } from "@/lib/permissions";
import { resizeAndUpload } from "@/lib/storage";
import { parseOr } from "@/lib/schemas/common";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { PublicProfile, Team } from "@/lib/types";

/**
 * Racha/% de asistencia de cada jugador — espejo de ListAdapterUser.kt, que
 * las muestra en línea para TODOS los miembros del equipo (no solo el
 * coach). Vía publicProfiles (calculado server-side por mirrorPublicProfile/
 * mirrorTeamAttendanceStats) — nunca se lee assistedTrainingDays ajeno.
 */
function usePlayerStats(names: string[]) {
  const [stats, setStats] = useState<Record<string, PublicProfile | null>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      names.map(async (name) => {
        const uid = await resolveUidByName(name);
        if (!uid) return [name, null] as const;
        const snap = await get(ref(db, `${PATHS.PUBLIC_PROFILES}/${uid}`));
        const profile = snap.exists()
          ? parseOr(PublicProfileSchema, snap.val(), `publicProfiles/${uid}`)
          : null;
        return [name, profile] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setStats(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [names]);

  return stats;
}

const MAX_MESSAGE_LENGTH = 500;

/** Aviso general del coach al equipo — espejo de SendGeneralMessageDialog.kt. */
function GeneralMessageDialog({ team }: { team: Team }) {
  const { firebaseUser, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const uids = (
        await Promise.all(team.userplayers.map((n) => resolveUidByName(n)))
      ).filter((u): u is string => u !== null);
      const { sent } = await sendGeneralMessage({
        teamName: team.teamname!,
        message: message.trim(),
        recipientUserIds: uids,
        senderUserId: firebaseUser?.uid ?? "",
        senderUsername: profile?.username ?? "",
      });
      toast.success(`Mensaje enviado a ${uids.length} jugadores (${sent} push)`);
      setMessage("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <Megaphone className="size-4" /> Enviar aviso al equipo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aviso para {team.teamname}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={message}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe tu mensaje…"
          rows={4}
        />
        <p className="text-right text-xs text-muted-foreground">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </p>
        <DialogFooter>
          <Button disabled={!message.trim() || sending} onClick={() => void send()}>
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fila de jugador en la lista del equipo — objetivo táctil 44px en las acciones. */
function PlayerRow({
  name,
  stats,
  action,
}: {
  name: string;
  stats?: PublicProfile | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg py-2 pr-1 pl-2 hover:bg-muted/50">
      <AvatarInitials name={name} size="sm" />
      <span className="flex-1 truncate text-sm">{name}</span>
      {stats && (typeof stats.streak === "number" || typeof stats.attendanceRate === "number") && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {typeof stats.streak === "number" && stats.streak > 0 && (
            <span className="flex items-center gap-0.5 text-warning" title="Racha actual">
              <Flame className="size-3" />
              {stats.streak}
            </span>
          )}
          {typeof stats.attendanceRate === "number" && (
            <span title="% de asistencia">{stats.attendanceRate}%</span>
          )}
        </span>
      )}
      {action}
    </div>
  );
}

// Gestión visible para el coach (o un ADMIN viendo el equipo, ver canManage
// en TeamManager) — mismo discriminador que Android (ReadTeam: usercoach ==
// uid), no el rol, salvo cuando viewingAsAdmin lo amplía explícitamente.
function PendingSection({ team, canManage }: { team: Team; canManage: boolean }) {
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
              canManage ? (
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

/**
 * Cuerpo de la pantalla de equipo, parametrizado por `teamname` explícito en
 * vez de derivarlo siempre de `profile.teamname` — así lo reutilizan
 * `/team` (el equipo propio), `/admin/teams/detail` (un equipo ajeno, con
 * `viewingAsAdmin`) y `/club/teams/detail` (un equipo del club que
 * administras, con `viewingAsClubAdmin`). Las reglas RTDB ya dan a ADMIN y
 * al admin del club lectura/escritura completa de los equipos que les
 * corresponden, así que ningún cambio de reglas hace falta aquí — ver
 * database.rules.json.
 */
export function TeamManager({
  teamname,
  viewingAsAdmin = false,
  viewingAsClubAdmin = false,
}: {
  teamname: string | null;
  viewingAsAdmin?: boolean;
  viewingAsClubAdmin?: boolean;
}) {
  const { firebaseUser, profile } = useAuth();
  const { team, coach, hasTeam, loading } = useTeam(teamname ?? undefined);
  const [kicking, setKicking] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const playerStats = usePlayerStats(team?.userplayers ?? []);
  const viewingAsSomeAdmin = viewingAsAdmin || viewingAsClubAdmin;

  if (loading) {
    return <TeamSkeleton />;
  }
  if (!hasTeam || team === null) {
    if (viewingAsSomeAdmin) {
      return <EmptyState icon={Users} title="Equipo no encontrado" />;
    }
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

  // Identidad real de coach (para el badge "Eres el entrenador") — distinta
  // de canManage, que además incluye al ADMIN global o al admin del club
  // viendo un equipo ajeno.
  const isLiteralCoach = team.usercoach === firebaseUser?.uid;
  const canManage = isLiteralCoach || (viewingAsAdmin && isAdmin(profile)) || viewingAsClubAdmin;
  // "Salir del equipo" es una acción de MIEMBRO — nunca tiene sentido para
  // alguien que está mirando un equipo ajeno del que no forma parte.
  const canLeave = !viewingAsSomeAdmin && !isLiteralCoach;

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

  const uploadIcon = async (file: File) => {
    setUploadingIcon(true);
    try {
      const url = await resizeAndUpload(`team_images/${team.teamname}`, file);
      await updateTeamIcon(team.teamname!, url);
      toast.success("Icono actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el icono");
    } finally {
      setUploadingIcon(false);
    }
  };

  const removeTeam = async () => {
    // El coach literal sigue usando la vía barata client-side (deleteTeam);
    // un ADMIN sobre un equipo ajeno pasa por la Cloud Function, que además
    // reconvierte el contenido "Equipo" a "Privado" y limpia el icono en
    // Storage (ver adminDeleteTeam en lib/actions/team.ts).
    if (isLiteralCoach) {
      await deleteTeam(team);
    } else {
      await adminDeleteTeam(team.teamname!);
    }
    toast.success(`Equipo "${team.teamname}" eliminado`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {viewingAsSomeAdmin && (
        <Badge className="border-transparent bg-primary/15 text-brand">
          <ShieldCheck className="size-3" />
          {viewingAsClubAdmin ? "Viendo como admin del club" : "Viendo como administrador"}
        </Badge>
      )}
      <div className="flex items-center gap-4">
        <div className="relative">
          <AvatarInitials name={team.teamname} src={team.teamicon} className="size-16" fallbackClassName="text-lg" />
          {canManage && (
            <>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadIcon(file);
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute -right-1 -bottom-1 rounded-full"
                aria-label="Cambiar icono del equipo"
                disabled={uploadingIcon}
                onClick={() => iconInputRef.current?.click()}
              >
                <Camera className="size-3.5" />
              </Button>
            </>
          )}
        </div>
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
            {isLiteralCoach && (
              <Badge className="border-transparent bg-primary/15 text-brand">
                Eres el entrenador
              </Badge>
            )}
          </div>
        </div>
      </div>

      {canManage && <GeneralMessageDialog team={team} />}

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

      <PendingSection team={team} canManage={canManage} />

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
                stats={playerStats[name]}
                action={
                  canManage ? (
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

      {canLeave && (
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

      {canManage && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
              <Trash2 className="size-4" /> Eliminar equipo
            </Button>
          }
          title={`¿Eliminar ${team.teamname}?`}
          description="Se eliminará el equipo permanentemente y todos los jugadores quedarán sin equipo."
          confirmLabel="Eliminar equipo"
          destructive
          onConfirm={removeTeam}
        />
      )}
    </div>
  );
}
