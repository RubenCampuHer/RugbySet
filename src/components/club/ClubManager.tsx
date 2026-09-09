"use client";

import { equalTo, get, onValue, orderByChild, query, ref } from "firebase/database";
import { Camera, Check, Crown, LogOut, Pencil, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllTeams } from "@/hooks/useAllTeams";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import {
  addTeamToClub,
  adminDeleteClub,
  approveTeamJoin,
  rejectTeamJoin,
  removeDirector,
  removeTeamFromClub,
  transferClubOwnership,
  updateClubContentStatus,
  updateClubIcon,
  updateClubName,
} from "@/lib/actions/club";
import { updateTeamCategory } from "@/lib/actions/team";
import { resizeAndUpload } from "@/lib/storage";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseMapOr, parseOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import { isAdmin } from "@/lib/permissions";
import { TeamSchema } from "@/lib/schemas/team";
import { CLUB_CATEGORIES, validateClubName } from "@/lib/team-validation";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Club, Exercise, Team, Training } from "@/lib/types";

const NO_CATEGORY = "__none__";

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

type PendingContentRow =
  | { kind: "exercise"; name: string; item: Exercise }
  | { kind: "training"; name: string; item: Training };

/**
 * Ejercicios/entrenos privacy=="Club" de ESTE club, pendientes de
 * aprobación — query indexada por clubId (ver .indexOn en
 * database.rules.json), filtrado por approvalStatus en cliente (pocos
 * ítems por club).
 */
function useClubPendingContent(clubId: string) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [trainings, setTrainings] = useState<Training[] | null>(null);

  useEffect(() => {
    return onValue(
      query(ref(db, PATHS.EXERCISES), orderByChild("clubId"), equalTo(clubId)),
      (snap) => setExercises(parseMapOr(ExerciseSchema, snap.val(), "Exercises")),
      () => setExercises([]),
    );
  }, [clubId]);

  useEffect(() => {
    return onValue(
      query(ref(db, PATHS.TRAININGS), orderByChild("clubId"), equalTo(clubId)),
      (snap) => setTrainings(parseMapOr(TrainingSchema, snap.val(), "Trainings")),
      () => setTrainings([]),
    );
  }, [clubId]);

  const pending: PendingContentRow[] = [
    ...(exercises ?? [])
      .filter((e) => e.name && e.approvalStatus === "PENDING")
      .map((e) => ({ kind: "exercise" as const, name: e.name!, item: e })),
    ...(trainings ?? [])
      .filter((t) => t.name && t.approvalStatus === "PENDING")
      .map((t) => ({ kind: "training" as const, name: t.name!, item: t })),
  ];

  return { pending, loading: exercises === null || trainings === null };
}

/**
 * Renombrar el club (2026-09-04, director o ADMIN) — Clubs/{clubId} usa un
 * id opaco, así que es un campo normal (nada de mover claves como con los
 * equipos). De uso único aquí, patrón local como ChangeTeamCodeDialog.
 */
function RenameClubDialog({ clubId, currentName }: { clubId: string; currentName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(currentName);
      setError(null);
    }
  };

  const save = async () => {
    const err = validateClubName(name);
    setError(err);
    if (err) return;
    if (name.trim() === currentName) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await updateClubName(clubId, name);
      toast.success("Nombre del club actualizado");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo renombrar el club");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Renombrar club" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar club</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="rename-club-input">Nombre del club</Label>
          <Input
            id="rename-club-input"
            value={name}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
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
 * Sección "Directores" (rediseño multi-director 2026-09-03, mismo patrón
 * que CoachesSection en TeamManager): fundador + co-directores. Sin
 * pendientes — el nombramiento es directo, no una solicitud con
 * aprobación. Separación de responsabilidades pedida explícitamente por el
 * usuario: **ascender** a codirector solo se hace desde DENTRO del equipo
 * (TeamManager → sección "Entrenadores" → "Nombrar codirector del club");
 * esta sección de aquí es la única forma de **quitarlo** — "Quitar" lo ve
 * quien puede gestionar el club (`canRemoveDirector`: el fundador o un
 * ADMIN viendo un club ajeno — antes solo el fundador, hueco real
 * arreglado 2026-09-04) o cualquier co-director sobre sí mismo
 * (autoexclusión, sin pedir permiso a nadie).
 *
 * "Hacer fundador" (2026-09-04, "poder abandonar el club dejando a alguien
 * al mando"): reasigna adminUserId a un codirector ya existente. SOLO
 * transfiere — el fundador saliente queda como codirector normal (nunca
 * se autoexcluye en el mismo clic: un incidente real 2026-09-04 mostró
 * que combinar "transferir y salir" en un solo botón saca a alguien del
 * club por sorpresa sin vuelta atrás fácil). Dejar la dirección es un
 * paso aparte y consciente con la autoexclusión de abajo.
 */
function DirectorsSection({
  club,
  myUid,
  canRemoveDirector,
}: {
  club: Club;
  myUid: string | null | undefined;
  canRemoveDirector: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const directorUids = Object.keys(club.directors).filter((uid) => uid !== club.adminUserId);
  const profiles = useProfilesByUid([club.adminUserId, ...directorUids].filter((u): u is string => Boolean(u)));

  const remove = async (uid: string) => {
    setBusy(uid);
    try {
      await removeDirector(club, uid);
      toast.success(uid === myUid ? "Has dejado la dirección del club" : "Codirector eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  };

  const transfer = async (uid: string, name: string) => {
    setBusy(uid);
    try {
      await transferClubOwnership(club, uid);
      toast.success(`${name} es ahora el fundador del club`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo transferir");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Directores</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <div className="flex items-center gap-3 py-2">
          {/* Ficha de persona (2026-09-09): foto+nombre navegan a /profile/detail */}
          <Link
            href={`/profile/detail?uid=${encodeURIComponent(club.adminUserId ?? "")}`}
            className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
          >
            <AvatarInitials
              name={profiles[club.adminUserId ?? ""]?.nameSurname || "Fundador"}
              src={profiles[club.adminUserId ?? ""]?.usericon}
              size="sm"
            />
            <span className="flex-1 truncate text-sm">
              {profiles[club.adminUserId ?? ""]?.nameSurname || "Fundador"}
            </span>
          </Link>
          <Badge variant="outline">Fundador</Badge>
        </div>
        {directorUids.map((uid) => {
          const name = profiles[uid]?.nameSurname || "este codirector";
          return (
            <div key={uid} className="flex items-center gap-3 py-2">
              <Link
                href={`/profile/detail?uid=${encodeURIComponent(uid)}`}
                className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
              >
                <AvatarInitials
                  name={profiles[uid]?.nameSurname || "Codirector"}
                  src={profiles[uid]?.usericon}
                  size="sm"
                />
                <span className="flex-1 truncate text-sm">{profiles[uid]?.nameSurname || "Codirector"}</span>
              </Link>
              {canRemoveDirector && (
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Hacer a ${name} fundador del club`}
                      title="Hacer fundador"
                      disabled={busy === uid}
                    >
                      <Crown className="size-4" />
                    </Button>
                  }
                  title={`¿Hacer a ${name} fundador del club?`}
                  description="El fundador actual pasará a ser codirector — para dejar la dirección, hazlo aparte con la autoexclusión de tu propia fila."
                  confirmLabel="Transferir"
                  onConfirm={() => transfer(uid, name)}
                />
              )}
              {(canRemoveDirector || uid === myUid) && (
                // Con confirmación explícita (2026-09-04): el icono de papelera
                // sugería "echar del club"; solo le quita la DIRECCIÓN — sigue
                // en su equipo como entrenador.
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon-xl"
                      variant="ghost"
                      className="rounded-full text-destructive hover:text-destructive"
                      aria-label={
                        uid === myUid
                          ? "Dejar la dirección del club (sigues en tu equipo)"
                          : `Quitar a ${name} de la dirección (sigue en su equipo)`
                      }
                      title={uid === myUid ? "Dejar la dirección" : "Quitar de la dirección"}
                      disabled={busy === uid}
                    >
                      {uid === myUid ? <LogOut className="size-4" /> : <Trash2 className="size-4" />}
                    </Button>
                  }
                  title={
                    uid === myUid
                      ? "¿Dejar la dirección del club?"
                      : `¿Quitar a ${name} de la dirección del club?`
                  }
                  description={
                    uid === myUid
                      ? "Seguirás en tu equipo como entrenador. Solo dejas de dirigir el club."
                      : "Seguirá en su equipo como entrenador. Solo deja de dirigir el club."
                  }
                  confirmLabel={uid === myUid ? "Dejar la dirección" : "Quitar de la dirección"}
                  destructive
                  onConfirm={() => remove(uid)}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * "+ Añadir equipo existente" — SOLO ADMIN global (2026-09-03, "los equipos
 * que yo quiera"): un director normal no puede añadir un equipo arbitrario
 * sin su consentimiento (la .validate de clubId se lo impide salvo que sea
 * su propio equipo o ya hubiera pedido unirse — anti-abuso, QA 2026-08-21),
 * solo un ADMIN global la salta. Por eso este control no aparece para un
 * director cualquiera, solo con viewingAsAdmin. Lista equipos SIN club
 * todavía — mover un equipo de un club a otro no es lo que pide esto.
 */
function AddTeamDialog({ club }: { club: Club }) {
  const [open, setOpen] = useState(false);
  const { teams } = useAllTeams();
  const availableTeams = teams.filter(({ team }) => !team.clubId);
  const [teamname, setTeamname] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!teamname) return;
    setAdding(true);
    try {
      await addTeamToClub(club, teamname);
      toast.success(`${teamname} añadido al club`);
      setOpen(false);
      setTeamname("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo añadir el equipo");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-3.5" /> Añadir equipo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir equipo a {club.clubname}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Equipo (sin club todavía)</Label>
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
            <p className="text-xs text-muted-foreground">No hay equipos sin club todavía.</p>
          )}
        </div>
        <DialogFooter>
          <Button disabled={adding || !teamname} onClick={() => void add()}>
            {adding ? "Añadiendo…" : "Añadir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Panel completo del director del club: contenido pendiente de aprobar +
 * solicitudes pendientes de equipos + roster de equipos + directores.
 * `club` viene de useClub() (onValue en tiempo real) — no hace falta
 * refrescar a mano tras aceptar/rechazar/quitar/nombrar.
 *
 * `viewingAsAdmin` (panel /admin/clubs): mismo patrón que TeamManager — un
 * ADMIN global ya tiene permiso RTDB total sobre cualquier club, esto solo
 * añade el badge y evita que las acciones de "soy fundador"/"soy director"
 * (que comparan contra mi propio uid) bloqueen a un admin que no lo es.
 */
export function ClubManager({ club, viewingAsAdmin = false }: { club: Club; viewingAsAdmin?: boolean }) {
  const { firebaseUser, profile } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const teamsPreview = useTeamsPreview(club.teams);
  const { pending: pendingContent } = useClubPendingContent(club.clubId!);

  const myUid = firebaseUser?.uid;
  const isFounder = myUid === club.adminUserId;
  const isDirector = isFounder || club.directors[myUid ?? ""] === true;
  // 2026-09-04: un ADMIN gestiona siempre, no solo entrando por /admin
  // (viewingAsAdmin queda para el badge) — mismo criterio que TeamManager.
  const canManage = isDirector || isAdmin(profile);
  // Borrar el club es más grave que gestionarlo día a día — igual que
  // "Eliminar equipo" en TeamManager, nunca un co-director cualquiera, solo
  // el fundador o un ADMIN.
  const canDeleteClub = isFounder || isAdmin(profile);
  const [deleting, setDeleting] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Icono del club (2026-09-04, director o ADMIN) — mismo patrón que el
  // icono de equipo en TeamManager; misma carpeta que usa el onboarding.
  const uploadIcon = async (file: File) => {
    setUploadingIcon(true);
    try {
      const url = await resizeAndUpload(`club_icons/${club.clubname}`, file);
      await updateClubIcon(club.clubId!, url);
      toast.success("Icono del club actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el icono");
    } finally {
      setUploadingIcon(false);
    }
  };

  const removeClub = async () => {
    setDeleting(true);
    try {
      await adminDeleteClub(club.clubId!);
      toast.success(`Club "${club.clubname}" eliminado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar el club");
    } finally {
      setDeleting(false);
    }
  };

  const decideContent = async (row: PendingContentRow, approve: boolean) => {
    const key = `${row.kind}-${row.name}`;
    setBusy(key);
    try {
      await updateClubContentStatus(row.kind, row.name, approve ? "APPROVED" : "REJECTED");
      toast.success(`"${row.name}" ${approve ? "aprobado" : "rechazado"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(null);
    }
  };

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

  const setCategory = async (teamname: string, category: string | null) => {
    try {
      await updateTeamCategory(teamname, category);
      toast.success(`Categoría de ${teamname} actualizada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar la categoría");
    }
  };

  return (
    <div className="space-y-4">
      {viewingAsAdmin && (
        <Badge className="border-transparent bg-primary/15 text-brand">
          <ShieldCheck className="size-3" /> Viendo como administrador
        </Badge>
      )}
      <div className="flex items-center gap-4">
        <div className="relative">
          <AvatarInitials name={club.clubname} src={club.clubicon} className="size-16" fallbackClassName="text-lg" />
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
                aria-label="Cambiar icono del club"
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
            <h1 className="text-2xl font-bold">{club.clubname}</h1>
            {canManage && <RenameClubDialog clubId={club.clubId!} currentName={club.clubname ?? ""} />}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {club.clubcode && (
              <span className="text-sm text-muted-foreground">Código: {club.clubcode}</span>
            )}
            {isFounder && (
              <Badge className="border-transparent bg-primary/15 text-brand">
                <ShieldCheck className="size-3" /> Eres el fundador
              </Badge>
            )}
            {isDirector && !isFounder && (
              <Badge className="border-transparent bg-primary/15 text-brand">
                <ShieldCheck className="size-3" /> Eres codirector
              </Badge>
            )}
          </div>
        </div>
      </div>

      <DirectorsSection club={club} myUid={myUid} canRemoveDirector={canDeleteClub} />

      {pendingContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Contenido pendiente de aprobar ({pendingContent.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {pendingContent.map((row) => (
              <div key={`${row.kind}-${row.name}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.kind === "exercise" ? "Ejercicio" : "Entreno"}
                    {row.item.author && ` · de ${row.item.author}`}
                  </p>
                </div>
                {canManage && (
                  <span className="flex shrink-0 gap-1">
                    <Button
                      size="icon-xl"
                      aria-label={`Aprobar ${row.name}`}
                      disabled={busy === `${row.kind}-${row.name}`}
                      className="rounded-full bg-accent text-accent-foreground hover:bg-accent/80"
                      onClick={() => void decideContent(row, true)}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon-xl"
                      variant="destructive"
                      aria-label={`Rechazar ${row.name}`}
                      disabled={busy === `${row.kind}-${row.name}`}
                      className="rounded-full"
                      onClick={() => void decideContent(row, false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                {canManage && (
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
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg">Equipos ({club.teams.length})</CardTitle>
          {viewingAsAdmin && isAdmin(profile) && <AddTeamDialog club={club} />}
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {club.teams.length === 0 ? (
            <EmptyState icon={Users} title="Este club todavía no tiene equipos" />
          ) : (
            club.teams.map((name) => {
              const team = teamsPreview[name];
              // Viendo como admin (/admin/clubs/detail) el visitante no
              // necesariamente dirige ESTE club, así que /club/teams/detail
              // (gateado a "administro algún club") le daría un callejón sin
              // salida — enlaza a /admin/teams/detail, que solo mira su rol.
              const teamDetailHref = viewingAsAdmin
                ? `/admin/teams/detail?name=${encodeURIComponent(name)}`
                : `/club/teams/detail?name=${encodeURIComponent(name)}`;
              return (
                <div key={name} className="space-y-1.5 py-2">
                  <div className="flex items-center gap-3">
                    <Link
                      href={teamDetailHref}
                      className="flex flex-1 items-center gap-3 truncate rounded-lg py-1 pr-1 pl-1 hover:bg-muted/50"
                    >
                      <AvatarInitials name={name} src={team?.teamicon} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        {team && (
                          <p className="truncate text-xs text-muted-foreground">
                            {Object.keys(team.userplayers).length} jugador{Object.keys(team.userplayers).length === 1 ? "" : "es"}
                            {team.category && ` · ${team.category}`}
                          </p>
                        )}
                      </div>
                    </Link>
                    {canManage && (
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
                    )}
                  </div>
                  {canManage && team && (
                    <div className="flex items-center gap-2 pl-1">
                      <Label className="shrink-0 text-xs text-muted-foreground">Categoría</Label>
                      <Select
                        value={team.category ?? NO_CATEGORY}
                        onValueChange={(v) => void setCategory(name, v === NO_CATEGORY ? null : (v ?? null))}
                      >
                        <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={`Categoría de ${name}`}>
                          <SelectValue className="min-w-0">
                            <span className="truncate">{team.category || "Sin categoría"}</span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                          {CLUB_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canDeleteClub && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" disabled={deleting}>
              <Trash2 className="size-4" /> Eliminar club
            </Button>
          }
          title={`¿Eliminar ${club.clubname}?`}
          description="Los equipos del club siguen existiendo tal cual, solo dejan de pertenecer a un club."
          confirmLabel="Eliminar club"
          destructive
          onConfirm={removeClub}
        />
      )}
    </div>
  );
}
