"use client";

import { equalTo, get, onValue, orderByChild, query, ref } from "firebase/database";
import { ArrowUpCircle, Check, LogOut, ShieldCheck, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import {
  appointDirector,
  approveTeamJoin,
  rejectTeamJoin,
  removeDirector,
  removeTeamFromClub,
  updateClubContentStatus,
} from "@/lib/actions/club";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseMapOr, parseOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import { isAdmin } from "@/lib/permissions";
import { TeamSchema } from "@/lib/schemas/team";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Club, Exercise, Team, Training } from "@/lib/types";

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
 * Sección "Directores" (rediseño multi-director 2026-09-03, mismo patrón
 * que CoachesSection en TeamManager): fundador + co-directores. Sin
 * pendientes — el nombramiento es directo (ver botón "Nombrar codirector"
 * en cada fila de equipo, más abajo), no una solicitud con aprobación.
 * "Quitar" solo lo ve el fundador sobre otro director, o cualquier
 * co-director sobre sí mismo (autoexclusión).
 */
function DirectorsSection({
  club,
  myUid,
  isFounder,
}: {
  club: Club;
  myUid: string | null | undefined;
  isFounder: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const directorUids = Object.keys(club.directors).filter((uid) => uid !== club.adminUserId);
  const profiles = useProfilesByUid([club.adminUserId, ...directorUids].filter((u): u is string => Boolean(u)));

  if (directorUids.length === 0) return null;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Directores</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <div className="flex items-center gap-3 py-2">
          <AvatarInitials name={profiles[club.adminUserId ?? ""]?.nameSurname || "Fundador"} size="sm" />
          <span className="flex-1 truncate text-sm">
            {profiles[club.adminUserId ?? ""]?.nameSurname || "Fundador"}
          </span>
          <Badge variant="outline">Fundador</Badge>
        </div>
        {directorUids.map((uid) => (
          <div key={uid} className="flex items-center gap-3 py-2">
            <AvatarInitials name={profiles[uid]?.nameSurname || "Codirector"} size="sm" />
            <span className="flex-1 truncate text-sm">{profiles[uid]?.nameSurname || "Codirector"}</span>
            {(isFounder || uid === myUid) && (
              <Button
                size="icon-xl"
                variant="ghost"
                className="rounded-full text-destructive hover:text-destructive"
                aria-label={uid === myUid ? "Salir de la dirección" : `Quitar a ${profiles[uid]?.nameSurname ?? "este codirector"}`}
                disabled={busy === uid}
                onClick={() => void remove(uid)}
              >
                {uid === myUid ? <LogOut className="size-4" /> : <Trash2 className="size-4" />}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
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
  const canManage = isDirector || (viewingAsAdmin && isAdmin(profile));

  const appoint = async (teamCoachUid: string, teamCoachName: string) => {
    setBusy(teamCoachUid);
    try {
      await appointDirector(club, teamCoachUid);
      toast.success(`${teamCoachName} nombrado codirector`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo nombrar");
    } finally {
      setBusy(null);
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

  const teamCoachUids = Object.values(teamsPreview)
    .map((t) => t?.usercoach)
    .filter((u): u is string => Boolean(u));
  const teamCoachProfiles = useProfilesByUid(teamCoachUids);

  return (
    <div className="space-y-4">
      {viewingAsAdmin && (
        <Badge className="border-transparent bg-primary/15 text-brand">
          <ShieldCheck className="size-3" /> Viendo como administrador
        </Badge>
      )}
      <div className="flex items-center gap-4">
        <AvatarInitials name={club.clubname} src={club.clubicon} className="size-16" fallbackClassName="text-lg" />
        <div>
          <h1 className="text-2xl font-bold">{club.clubname}</h1>
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

      <DirectorsSection club={club} myUid={myUid} isFounder={isFounder} />

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
                  {canManage &&
                    team?.usercoach &&
                    club.adminUserId !== team.usercoach &&
                    club.directors[team.usercoach] !== true && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Nombrar codirector a ${teamCoachProfiles[team.usercoach]?.nameSurname ?? "el entrenador de " + name}`}
                        title="Nombrar codirector"
                        disabled={busy === team.usercoach}
                        onClick={() => void appoint(team.usercoach!, teamCoachProfiles[team.usercoach!]?.nameSurname || "El entrenador")}
                      >
                        <ArrowUpCircle className="size-4" />
                      </Button>
                    )}
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
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
