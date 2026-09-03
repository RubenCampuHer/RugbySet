"use client";

import { get, ref } from "firebase/database";
import { ArrowUpCircle, Camera, Check, ClipboardList, Copy, Flame, LogOut, Megaphone, ShieldCheck, Trash2, Trophy, Users, X } from "lucide-react";
import Link from "next/link";
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
import { Button, buttonVariants } from "@/components/ui/button";
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
import { useClub } from "@/hooks/useClub";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { useTeam } from "@/hooks/useTeam";
import { appointDirector } from "@/lib/actions/club";
import {
  acceptPendingCoach,
  acceptPendingPlayer,
  adminDeleteTeam,
  deleteTeam,
  leaveTeam,
  promoteToCoach,
  rejectPendingCoach,
  rejectPendingPlayer,
  removeCoach,
  removePlayer,
  resolveUidByName,
  updateTeamIcon,
} from "@/lib/actions/team";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { sendGeneralMessage } from "@/lib/actions/notify";
import { isAdmin, isTeamCoach, isTeamFounder } from "@/lib/permissions";
import { resizeAndUpload } from "@/lib/storage";
import { parseOr } from "@/lib/schemas/common";
import { PublicProfileSchema } from "@/lib/schemas/user";
import type { Club, PublicProfile, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

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
 * Sección "Entrenadores" (rediseño multi-coach 2026-09-03, unificada
 * 2026-09-03 tras QA real: antes el fundador vivía en una tarjeta "Entrenador"
 * aparte de esta, así que un equipo con co-entrenadores mostraba DOS sitios
 * distintos con pinta de lista de entrenadores — confuso). Fundador (badge
 * "Fundador", sin botón de quitar — para eso está "Eliminar equipo") +
 * co-entrenadores aceptados + solicitudes pendientes, siempre visible (un
 * equipo siempre tiene fundador). Acciones solo para quien gestiona el
 * equipo. Quitar a un co-entrenador ya aceptado es exclusivo del fundador o
 * de un ADMIN/admin de club viendo el equipo (canRemoveCoach — mismo
 * criterio que canDeleteTeam: un ADMIN viendo un equipo ajeno nunca es el
 * fundador literal, así que sin este bypass el botón no aparecía nunca).
 *
 * "Nombrar codirector del club" (2026-09-03, pedido explícito: hacerlo
 * también desde DENTRO del equipo, no solo desde la lista de equipos del
 * club) — visible en cada fila (fundador o co-entrenador) si este equipo
 * pertenece a un club (`club` no null) y quien mira dirige ESE club o es
 * ADMIN (`canAppointDirector`); oculto si ese entrenador ya es director.
 */
function CoachesSection({
  team,
  club,
  canManage,
  canRemoveCoach,
  canAppointDirector,
}: {
  team: Team;
  club: Club | null;
  canManage: boolean;
  canRemoveCoach: boolean;
  canAppointDirector: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const founderUid = team.usercoach;
  const coCoachUids = Object.keys(team.coaches);
  const pendingUids = Object.keys(team.pendingCoaches);
  const profiles = useProfilesByUid(
    [founderUid, ...coCoachUids, ...pendingUids].filter((u): u is string => Boolean(u)),
  );

  const act = async (uid: string, accept: boolean) => {
    setBusy(uid);
    try {
      if (accept) {
        await acceptPendingCoach(team, uid);
        toast.success("Co-entrenador aceptado");
      } else {
        await rejectPendingCoach(team, uid);
        toast.success("Solicitud rechazada");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (uid: string) => {
    setBusy(uid);
    try {
      await removeCoach(team, uid);
      toast.success("Co-entrenador eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo quitar");
    } finally {
      setBusy(null);
    }
  };

  const appoint = async (uid: string, name: string) => {
    if (!club) return;
    setBusy(uid);
    try {
      await appointDirector(club, uid);
      toast.success(`${name} nombrado codirector del club`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo nombrar");
    } finally {
      setBusy(null);
    }
  };

  const canOfferDirector = (uid: string) =>
    canAppointDirector && Boolean(club) && club!.adminUserId !== uid && club!.directors[uid] !== true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Entrenadores</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {founderUid && (
          <div className="flex items-center gap-3 rounded-lg py-2 pr-1 pl-2">
            <AvatarInitials name={profiles[founderUid]?.nameSurname || "Entrenador"} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{profiles[founderUid]?.nameSurname || "Entrenador"}</p>
              {profiles[founderUid]?.username && (
                <p className="truncate text-xs text-muted-foreground">@{profiles[founderUid]?.username}</p>
              )}
            </div>
            <Badge variant="outline">Fundador</Badge>
            {canOfferDirector(founderUid) && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Nombrar codirector del club a ${profiles[founderUid]?.nameSurname ?? "el entrenador"}`}
                title="Nombrar codirector del club"
                disabled={busy === founderUid}
                onClick={() => void appoint(founderUid, profiles[founderUid]?.nameSurname || "El entrenador")}
              >
                <ArrowUpCircle className="size-4" />
              </Button>
            )}
          </div>
        )}
        {coCoachUids.map((uid) => (
          <PlayerRow
            key={uid}
            name={profiles[uid]?.nameSurname || "Entrenador"}
            action={
              canRemoveCoach || canOfferDirector(uid) ? (
                <span className="flex gap-1">
                  {canOfferDirector(uid) && (
                    <Button
                      size="icon-xl"
                      variant="ghost"
                      aria-label={`Nombrar codirector del club a ${profiles[uid]?.nameSurname ?? "este entrenador"}`}
                      title="Nombrar codirector del club"
                      disabled={busy === uid}
                      onClick={() => void appoint(uid, profiles[uid]?.nameSurname || "El entrenador")}
                    >
                      <ArrowUpCircle className="size-4" />
                    </Button>
                  )}
                  {canRemoveCoach && (
                    <Button
                      size="icon-xl"
                      variant="ghost"
                      className="rounded-full text-destructive hover:text-destructive"
                      aria-label={`Quitar a ${profiles[uid]?.nameSurname ?? "este co-entrenador"}`}
                      disabled={busy === uid}
                      onClick={() => void remove(uid)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </span>
              ) : undefined
            }
          />
        ))}
        {pendingUids.map((uid) => (
          <PlayerRow
            key={uid}
            name={profiles[uid]?.nameSurname || "Solicitud pendiente"}
            action={
              canManage ? (
                <span className="flex gap-1">
                  <Button
                    size="icon-xl"
                    className="rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                    aria-label={`Aceptar a ${profiles[uid]?.nameSurname ?? "co-entrenador"}`}
                    disabled={busy === uid}
                    onClick={() => void act(uid, true)}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon-xl"
                    variant="destructive"
                    className="rounded-full"
                    aria-label={`Rechazar a ${profiles[uid]?.nameSurname ?? "co-entrenador"}`}
                    disabled={busy === uid}
                    onClick={() => void act(uid, false)}
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
  const { team, hasTeam, loading } = useTeam(teamname ?? undefined);
  // Club de ESTE equipo (si tiene), no el que yo administro — clubId
  // explícito (aunque sea null) para que useClub nunca caiga al fallback de
  // "mi propio club" (ver useClub.ts). Solo importa para "Nombrar
  // codirector del club" en CoachesSection, más abajo.
  const { club } = useClub(team?.clubId ?? null);
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

  // Fundador (isFounder, el usercoach histórico — único que no puede
  // "salir" y único que puede quitar a un co-entrenador) vs "gestiona este
  // equipo" (isMyCoach, fundador O co-entrenador aceptado — mismos permisos
  // de gestión día a día, rediseño multi-coach 2026-09-03). canManage
  // además incluye al ADMIN global o al admin del club viendo un equipo
  // ajeno; canDeleteTeam es más estricto (nunca un co-entrenador, solo
  // quien fundó el equipo o un admin).
  const isFounder = isTeamFounder(team, firebaseUser?.uid);
  const isMyCoach = isTeamCoach(team, firebaseUser?.uid);
  const canManage = isMyCoach || (viewingAsAdmin && isAdmin(profile)) || viewingAsClubAdmin;
  const canDeleteTeam = isFounder || (viewingAsAdmin && isAdmin(profile)) || viewingAsClubAdmin;
  // "Salir del equipo" es una acción de MIEMBRO — nunca tiene sentido para
  // alguien que está mirando un equipo ajeno del que no forma parte, y el
  // fundador no puede salir (debe eliminar el equipo); un co-entrenador sí.
  const canLeave = !viewingAsSomeAdmin && !isFounder;
  // "Nombrar codirector del club" (pedido 2026-09-03: hacerlo también desde
  // dentro del equipo) — solo si este equipo pertenece a un club Y quien
  // mira dirige ESE club (fundador o codirector) o es ADMIN global. Un
  // admin de OTRO club viendo este equipo (viewingAsClubAdmin) no cuenta:
  // sería el director de un club ajeno al de este equipo en concreto.
  const isDirectorOfTeamClub = Boolean(
    club && firebaseUser?.uid && (club.adminUserId === firebaseUser.uid || club.directors[firebaseUser.uid] === true),
  );
  const canAppointDirector = Boolean(club) && (isDirectorOfTeamClub || (viewingAsAdmin && isAdmin(profile)));

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
    // El fundador sigue usando la vía barata client-side (deleteTeam); un
    // ADMIN sobre un equipo ajeno pasa por la Cloud Function, que además
    // limpia el icono en Storage (ver adminDeleteTeam en lib/actions/team.ts).
    if (isFounder) {
      await deleteTeam(team);
    } else {
      await adminDeleteTeam(team.teamname!);
    }
    toast.success(`Equipo "${team.teamname}" eliminado`);
  };

  const promote = async (name: string) => {
    try {
      await promoteToCoach(team, name);
      toast.success(`${name} ascendido a co-entrenador`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ascender");
    }
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
            {isFounder && (
              <Badge className="border-transparent bg-primary/15 text-brand">
                Eres el entrenador
              </Badge>
            )}
            {isMyCoach && !isFounder && (
              <Badge className="border-transparent bg-primary/15 text-brand">
                Eres co-entrenador
              </Badge>
            )}
          </div>
        </div>
      </div>

      {canManage && <GeneralMessageDialog team={team} />}

      {/*
        Sin viewingAsClubAdmin: el informe de asistencia (team/attendance)
        de momento solo reconoce coach literal + ADMIN global (ver plan) —
        mostrar el botón también al admin de club llevaría a un "Solo el
        entrenador" confuso al tocarlo.
      */}
      {canManage && !viewingAsClubAdmin && (
        <Link
          href={
            teamname
              ? `/team/attendance?team=${encodeURIComponent(teamname)}`
              : "/team/attendance"
          }
          className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full")}
        >
          <ClipboardList className="size-4" /> Ver asistencia
        </Link>
      )}

      {/*
        A diferencia de "Ver asistencia" (solo coach/ADMIN), las
        alineaciones publicadas son para todo el equipo — sin gate de
        canManage. Se oculta viendo un equipo ajeno (admin/admin de club)
        porque team/lineups solo reconoce miembro literal + ADMIN global
        (mismo criterio que "Ver asistencia" evita el enlace roto).
      */}
      {!viewingAsAdmin && !viewingAsClubAdmin && (
        <Link
          href="/team/lineups"
          className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full")}
        >
          <Trophy className="size-4" /> Ver alineaciones
        </Link>
      )}

      <PendingSection team={team} canManage={canManage} />

      <CoachesSection
        team={team}
        club={club}
        canManage={canManage}
        canRemoveCoach={canDeleteTeam}
        canAppointDirector={canAppointDirector}
      />

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
                    <span className="flex gap-1">
                      <Button
                        size="icon-xl"
                        variant="ghost"
                        className="rounded-full"
                        aria-label={`Ascender a ${name} a co-entrenador`}
                        title="Ascender a co-entrenador"
                        onClick={() => void promote(name)}
                      >
                        <ArrowUpCircle className="size-4" />
                      </Button>
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
                    </span>
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

      {canDeleteTeam && (
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
