"use client";

import { ArrowDownCircle, ArrowUpCircle, Camera, Check, ClipboardList, Copy, Crown, Flame, LogOut, Megaphone, Pencil, ShieldCheck, Trash2, TriangleAlert, Trophy, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { RenamePersonDialog } from "@/components/RenamePersonDialog";
import { RenameTeamDialog } from "@/components/team/RenameTeamDialog";
import { TeamSkeleton } from "@/components/skeletons";
import { CreateTeamDialog } from "@/components/team/CreateTeamDialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClub } from "@/hooks/useClub";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { useTeam } from "@/hooks/useTeam";
import { appointDirector } from "@/lib/actions/club";
import {
  acceptPendingCoach,
  acceptPendingPlayer,
  adminDeleteTeam,
  deleteTeam,
  demoteCoachToPlayer,
  leaveTeam,
  promoteToCoach,
  rejectPendingCoach,
  rejectPendingPlayer,
  removeCoach,
  removePlayer,
  transferTeamOwnership,
  updateTeamCode,
  updateTeamIcon,
} from "@/lib/actions/team";
import { sendGeneralMessage } from "@/lib/actions/notify";
import { isAdmin, isCoach, isTeamCoach, isTeamFounder } from "@/lib/permissions";
import { resizeAndUpload } from "@/lib/storage";
import { validateTeamCode } from "@/lib/team-validation";
import type { AttendanceStats, Club, PublicProfile, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

// Rosters por uid (2026-09-04): la racha/% de cada jugador se resuelve con
// useProfilesByUid(Object.keys(team.userplayers)) directamente en
// TeamManager, igual que ya hacía CoachesSection — el hook a medida que
// resolvía nombre→uid antes usado aquí ya no hace falta.

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
      // Rosters por uid (2026-09-04): userplayers ya son claves de uid.
      const uids = Object.keys(team.userplayers);
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

/**
 * Cambiar el código de acceso — campo normal de Teams/{teamname} (cubierto
 * por el mismo .write que roster/icono/categoría, sin Cloud Function). De
 * uso único aquí, mismo patrón local que GeneralMessageDialog arriba.
 */
function ChangeTeamCodeDialog({ teamname, currentCode }: { teamname: string; currentCode: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(currentCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setCode(currentCode);
      setError(null);
    }
  };

  const save = async () => {
    const err = validateTeamCode(code);
    setError(err);
    if (err) return;
    const trimmed = code.trim();
    if (trimmed === currentCode) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await updateTeamCode(teamname, trimmed);
      toast.success("Código actualizado");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el código");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button size="icon-sm" variant="ghost" aria-label="Cambiar código de acceso" />}
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Código de acceso</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="change-team-code-input">Código</Label>
          <Input
            id="change-team-code-input"
            value={code}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Los jugadores que ya se unieron no necesitan volver a introducirlo.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Stats de un jugador PARA ESTE equipo (varios equipos, fase 3): primero
 * publicProfiles.teamStats[equipo]; si el perfil aún no trae teamStats (mirror
 * pendiente), los campos planos solo valen si su equipo activo es este —
 * mostrar la racha de otro equipo aquí sería mentir.
 */
function statsForTeam(profile: PublicProfile | null | undefined, teamname: string): AttendanceStats | null {
  if (!profile) return null;
  const perTeam = profile.teamStats[teamname];
  if (perTeam) return perTeam;
  if (profile.teamname === teamname) {
    return { streak: profile.streak, maxStreak: profile.maxStreak, attendanceRate: profile.attendanceRate };
  }
  return null;
}

/** Fila de jugador en la lista del equipo — objetivo táctil 44px en las acciones. */
function PlayerRow({
  name,
  src,
  stats,
  action,
}: {
  name: string;
  /** usericon de publicProfiles — sin él no se veía la foto de nadie (bug real 2026-09-04). */
  src?: string | null;
  stats?: AttendanceStats | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg py-2 pr-1 pl-2 hover:bg-muted/50">
      <AvatarInitials name={name} src={src} size="sm" />
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
/** Rosters por uid (2026-09-04): pendingplayers es {uid: true} — el nombre se resuelve vía useProfilesByUid, como CoachesSection. */
function PendingSection({ team, canManage }: { team: Team; canManage: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const pendingUids = Object.keys(team.pendingplayers);
  const profiles = useProfilesByUid(pendingUids);
  if (pendingUids.length === 0) return null;

  const act = async (uid: string, name: string, accept: boolean) => {
    setBusy(uid);
    try {
      if (accept) {
        await acceptPendingPlayer(team, uid);
        toast.success(`${name} aceptado en el equipo`);
      } else {
        await rejectPendingPlayer(team, uid);
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
          Solicitudes pendientes ({pendingUids.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {pendingUids.map((uid) => {
          const name = profiles[uid]?.nameSurname || "Solicitud pendiente";
          return (
            <PlayerRow
              key={uid}
              name={name}
              src={profiles[uid]?.usericon}
              action={
                canManage ? (
                  <span className="flex gap-1">
                    <Button
                      size="icon-xl"
                      className="rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                      aria-label={`Aceptar a ${name}`}
                      disabled={busy === uid}
                      onClick={() => void act(uid, name, true)}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon-xl"
                      variant="destructive"
                      className="rounded-full"
                      aria-label={`Rechazar a ${name}`}
                      disabled={busy === uid}
                      onClick={() => void act(uid, name, false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </span>
                ) : undefined
              }
            />
          );
        })}
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

  // Inverso de "Ascender a co-entrenador" (2026-09-04): sigue en el equipo,
  // solo pasa de coaches a userplayers. Mismo gate que quitarle (fundador /
  // ADMIN / admin del club — un co-entrenador no desciende a otro).
  const demote = async (uid: string, name: string) => {
    setBusy(uid);
    try {
      await demoteCoachToPlayer(team, uid);
      toast.success(`${name} ahora es jugador`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descender");
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

  // Reasignar el entrenador principal a un co-entrenador ya existente
  // (pedido 2026-09-04: poder abandonar el equipo "dejando a alguien al
  // mando"). SOLO transfiere — el fundador saliente queda como
  // co-entrenador normal (nunca se auto-elimina en el mismo clic: un
  // incidente real 2026-09-04 mostró que combinar "transferir y salir" en
  // un solo botón saca a alguien del equipo por sorpresa sin vuelta atrás
  // fácil). Salir es un paso aparte y consciente con "Salir del equipo"
  // (ya disponible en cuanto se deja de ser el fundador literal).
  const transfer = async (uid: string, name: string) => {
    setBusy(uid);
    try {
      await transferTeamOwnership(team, uid);
      toast.success(`${name} es ahora el entrenador principal`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo transferir");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Entrenadores</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {founderUid && (
          <div className="flex items-center gap-3 rounded-lg py-2 pr-1 pl-2">
            <AvatarInitials
              name={profiles[founderUid]?.nameSurname || "Entrenador"}
              src={profiles[founderUid]?.usericon}
              size="sm"
            />
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
        {coCoachUids.map((uid) => {
          const name = profiles[uid]?.nameSurname || "este entrenador";
          return (
          <PlayerRow
            key={uid}
            name={profiles[uid]?.nameSurname || "Entrenador"}
            src={profiles[uid]?.usericon}
            action={
              canRemoveCoach || canOfferDirector(uid) ? (
                <span className="flex gap-1">
                  {canRemoveCoach && (
                    <ConfirmDialog
                      trigger={
                        <Button
                          size="icon-xl"
                          variant="ghost"
                          aria-label={`Hacer a ${name} entrenador principal`}
                          title="Hacer entrenador principal"
                          disabled={busy === uid}
                        >
                          <Crown className="size-4" />
                        </Button>
                      }
                      title={`¿Hacer a ${name} entrenador principal?`}
                      description="El entrenador actual pasará a ser co-entrenador — para salir del equipo, hazlo aparte con «Salir del equipo»."
                      confirmLabel="Transferir"
                      onConfirm={() => transfer(uid, name)}
                    />
                  )}
                  {canRemoveCoach && (
                    <ConfirmDialog
                      trigger={
                        <Button
                          size="icon-xl"
                          variant="ghost"
                          aria-label={`Descender a ${name} a jugador`}
                          title="Descender a jugador"
                          disabled={busy === uid}
                        >
                          <ArrowDownCircle className="size-4" />
                        </Button>
                      }
                      title={`¿Descender a ${name} a jugador?`}
                      description="Deja de gestionar el equipo pero sigue en él como jugador. Podrás volver a ascenderle cuando quieras."
                      confirmLabel="Descender"
                      onConfirm={() => demote(uid, name)}
                    />
                  )}
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
          );
        })}
        {pendingUids.map((uid) => (
          <PlayerRow
            key={uid}
            name={profiles[uid]?.nameSurname || "Solicitud pendiente"}
            src={profiles[uid]?.usericon}
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Club de ESTE equipo (si tiene), no el que yo administro — clubId
  // explícito (aunque sea null) para que useClub nunca caiga al fallback de
  // "mi propio club" (ver useClub.ts). Solo importa para "Nombrar
  // codirector del club" en CoachesSection, más abajo.
  const { club } = useClub(team?.clubId ?? null);
  // Varios equipos (fase 2): todas mis pertenencias, para distinguir "sin
  // ningún equipo" de "sin activo pero con equipos" y para "Más equipos".
  const { teams: myTeams, loading: loadingMyTeams } = useMyTeams();
  const [kicking, setKicking] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  // Rosters por uid (2026-09-04): mismo hook que ya usa CoachesSection para
  // entrenadores — sin nombre que resolver a mano, publicProfiles ya lo trae.
  const playerProfiles = useProfilesByUid(Object.keys(team?.userplayers ?? {}));
  const viewingAsSomeAdmin = viewingAsAdmin || viewingAsClubAdmin;
  // Bug real reportado 2026-09-04: la pantalla se quedaba "pensando" sin fin
  // (sin ningún error visible) — un listener de RTDB que por lo que sea
  // nunca dispara ni éxito ni error deja a `loading` en true para siempre.
  // Pasado este tiempo, ofrecer recargar en vez de un esqueleto indefinido.
  const stuck = useLoadingTimeout(loading);

  if (loading) {
    if (stuck) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Tarda más de lo normal"
          hint="Puede ser un problema de conexión — vuelve a intentarlo."
          action={<Button onClick={() => location.reload()}>Reintentar</Button>}
        />
      );
    }
    return <TeamSkeleton />;
  }
  if (!hasTeam || team === null) {
    if (viewingAsSomeAdmin) {
      return <EmptyState icon={Users} title="Equipo no encontrado" />;
    }
    // Sin activo pero con pertenencias (p. ej. recién expulsado del que
    // tenía activo): AuthProvider está recolocando el activo
    // (reconcileActiveTeam) — esqueleto un instante, no "sin equipo".
    if (!hasTeam && (loadingMyTeams || myTeams.length > 0)) {
      return <TeamSkeleton />;
    }
    const canCreate = isCoach(profile) || isAdmin(profile);
    return (
      <div className="space-y-4">
        <PageHeader title="Equipo" />
        <EmptyState
          icon={Users}
          title="No perteneces a ningún equipo"
          hint={
            canCreate
              ? "Introduce el código de un equipo o crea el tuyo."
              : "Introduce el código que te haya dado tu entrenador."
          }
        />
        <JoinTeamForm />
        {canCreate && (
          <div className="mx-auto max-w-sm">
            <CreateTeamDialog className="w-full" />
          </div>
        )}
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
  // 2026-09-04: un ADMIN gestiona SIEMPRE, también en su propio /team donde
  // solo es jugador (antes exigía entrar por /admin/teams/detail —
  // viewingAsAdmin — y en su equipo no veía ni "aceptar"). Las reglas RTDB
  // ya le daban permiso; era solo la UI. viewingAs* sigue valiendo para el
  // badge y para el admin de club, que no es ADMIN global.
  const canManage = isMyCoach || isAdmin(profile) || viewingAsClubAdmin;
  const canDeleteTeam = isFounder || isAdmin(profile) || viewingAsClubAdmin;
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
  const canAppointDirector = Boolean(club) && (isDirectorOfTeamClub || isAdmin(profile));

  const kick = async (uid: string, name: string) => {
    setKicking(uid);
    try {
      await removePlayer(team, uid);
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
      const { activeTeam } = await leaveTeam(team.teamname!);
      toast.success(
        activeTeam ? `Has salido de ${team.teamname}. Ahora estás en ${activeTeam}.` : "Has salido del equipo",
      );
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

  // El nombre viejo con el que se montó esta pantalla ya no existe tras
  // renombrar. En la vista propia (/team, sin ?team= en la URL) no hace
  // falta navegar: el perfil (useAuth) se actualiza solo y re-renderiza con
  // el nombre nuevo. En una vista explícita (?team=viejo, admin/club-admin
  // mirando un equipo ajeno) hay que corregir la URL a mano.
  const onTeamRenamed = (newTeamname: string) => {
    // /admin/teams/detail y /club/teams/detail usan ?name= (no ?team=, que es
    // el de /team/attendance y /team/lineups).
    if (searchParams.get("name") === team.teamname) {
      const params = new URLSearchParams(searchParams);
      params.set("name", newTeamname);
      router.replace(`${pathname}?${params.toString()}`);
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

  const promote = async (uid: string, name: string) => {
    try {
      await promoteToCoach(team, uid);
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
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold">{team.teamname}</h1>
            {canManage && <RenameTeamDialog teamname={team.teamname!} onRenamed={onTeamRenamed} />}
          </div>
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
            {canManage && <ChangeTeamCodeDialog teamname={team.teamname!} currentCode={team.teamcode ?? ""} />}
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
            Jugadores ({Object.keys(team.userplayers).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {Object.keys(team.userplayers).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin jugadores.</p>
          ) : (
            Object.keys(team.userplayers)
              .sort((a, b) =>
                (playerProfiles[a]?.nameSurname ?? "").localeCompare(
                  playerProfiles[b]?.nameSurname ?? "",
                  "es",
                ),
              )
              .map((uid) => {
                const name = playerProfiles[uid]?.nameSurname || "Jugador";
                return (
                  <PlayerRow
                    key={uid}
                    name={name}
                    src={playerProfiles[uid]?.usericon}
                    stats={statsForTeam(playerProfiles[uid], team.teamname!)}
                    action={
                      canManage ? (
                        <span className="flex gap-1">
                          <RenamePersonDialog uid={uid} currentName={name} triggerSize="icon-xl" />
                          <Button
                            size="icon-xl"
                            variant="ghost"
                            className="rounded-full"
                            aria-label={`Ascender a ${name} a co-entrenador`}
                            title="Ascender a co-entrenador"
                            onClick={() => void promote(uid, name)}
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
                                disabled={kicking === uid}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title={`¿Expulsar a ${name}?`}
                            description="Perderá el acceso al equipo y su historial de asistencia."
                            confirmLabel="Expulsar"
                            destructive
                            onConfirm={() => kick(uid, name)}
                          />
                        </span>
                      ) : undefined
                    }
                  />
                );
              })
          )}
        </CardContent>
      </Card>

      {/* Varios equipos (fase 2): unirse a más equipos / crear otro, sin
          perder el actual. Nunca viendo un equipo ajeno como admin. */}
      {!viewingAsSomeAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Más equipos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Puedes estar en varios equipos a la vez
              {myTeams.length > 1
                ? ` (ahora en ${myTeams.length}) — cambia el activo desde la cabecera.`
                : "."}
            </p>
            {showJoin ? (
              <JoinTeamForm />
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowJoin(true)}>
                <UserPlus className="size-4" /> Unirme a otro equipo con código
              </Button>
            )}
            {(isCoach(profile) || isAdmin(profile)) && <CreateTeamDialog className="w-full" />}
          </CardContent>
        </Card>
      )}

      {canLeave && (
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              disabled={leaving}
            >
              <LogOut className="size-4" /> Salir de {team.teamname}
            </Button>
          }
          title={`¿Salir de ${team.teamname}?`}
          description={
            myTeams.length > 1
              ? "Seguirás en tus otros equipos. Tendrás que volver a unirte con el código si cambias de opinión."
              : "Tendrás que volver a unirte con el código del equipo si cambias de opinión."
          }
          confirmLabel="Salir del equipo"
          destructive
          onConfirm={leave}
        />
      )}

      {/* El fundador no tiene "Salir" (el equipo necesita un entrenador
          principal): decirlo, en vez de que el botón simplemente no esté
          (pregunta real 2026-09-04: "¿cuál es el botón de salir?"). */}
      {isFounder && !viewingAsSomeAdmin && (
        <p className="text-center text-xs text-muted-foreground">
          Para salir del equipo, primero haz entrenador principal a un co-entrenador (corona en
          «Entrenadores»); después te aparecerá aquí «Salir de {team.teamname}».
          {Object.keys(team.coaches).length === 0 && " Ahora mismo no hay ningún co-entrenador."}
        </p>
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
