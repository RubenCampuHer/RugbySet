"use client";

import { get, ref } from "firebase/database";
import { Building2, LinkIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyTeams } from "@/hooks/useMyTeams";
import { getClubByCode, requestJoinClub } from "@/lib/actions/club";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { isTeamCoach } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { TeamSchema } from "@/lib/schemas/team";
import type { Club, Team } from "@/lib/types";

/**
 * Invitación a un club por enlace (/join-club?code=…, 2026-09-25). Al club
 * entran EQUIPOS: quien abre el enlace, si entrena un equipo sin club, pide
 * el ingreso (Clubs/{id}/pendingTeams, lo aprueba un director) — mismo
 * requestJoinClub que la tarjeta de /club. El enlace no salta la aprobación.
 */
function JoinClubContent() {
  const params = useSearchParams();
  const code = params.get("code")?.trim() || null;
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const { teams: teamNames, loading: teamsLoading } = useMyTeams();
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [coachTeams, setCoachTeams] = useState<Team[] | undefined>(undefined);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !uid) return;
    let cancelled = false;
    getClubByCode(code)
      .then((c) => !cancelled && setClub(c))
      .catch(() => !cancelled && setClub(null));
    return () => {
      cancelled = true;
    };
  }, [code, uid]);

  const namesKey = teamNames.join("|");
  useEffect(() => {
    if (teamsLoading || !uid) return;
    let cancelled = false;
    void Promise.all(
      teamNames.map(async (name) => {
        const snap = await get(ref(db, `${PATHS.TEAMS}/${name}`));
        return snap.exists() ? parseOr(TeamSchema, snap.val(), `Teams/${name}`) : null;
      }),
    ).then((list) => {
      if (!cancelled) setCoachTeams(list.filter((t): t is Team => t != null && isTeamCoach(t, uid)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- namesKey resume teamNames
  }, [namesKey, teamsLoading, uid]);

  const request = async (team: Team) => {
    if (!club) return;
    setBusy(team.teamname!);
    try {
      await requestJoinClub(club, team.teamname!);
      setRequested((prev) => new Set(prev).add(team.teamname!));
      toast.success(`Solicitud enviada a ${club.clubname}. Un director del club debe aprobarla.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud");
    } finally {
      setBusy(null);
    }
  };

  if (!code) {
    return <EmptyState icon={LinkIcon} title="Enlace no válido" hint="Pide al club que te vuelva a enviar la invitación." />;
  }
  if (club === undefined || coachTeams === undefined) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }
  if (club === null) {
    return <EmptyState icon={Building2} title="Club no encontrado" hint="Puede que el club haya cambiado su código. Pide un enlace nuevo." />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center gap-3">
          <AvatarInitials name={club.clubname ?? "Club"} src={club.clubicon} className="size-12" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{club.clubname}</p>
            <p className="text-sm text-muted-foreground">Te invita a unir tu equipo al club</p>
          </div>
        </CardContent>
      </Card>

      {coachTeams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta invitación es para entrenadores: al club se une el equipo entero. Si juegas en un equipo, pásale el
          enlace a tu entrenador.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">{coachTeams.length === 1 ? "Tu equipo" : "Tus equipos"}</p>
          {coachTeams.map((team) => {
            const name = team.teamname!;
            const inThisClub = team.clubId === club.clubId;
            const inOtherClub = Boolean(team.clubId) && !inThisClub;
            const pending = requested.has(name) || club.pendingTeams[name] === true;
            return (
              <div key={name} className="flex items-center gap-3 rounded-xl border p-3">
                <AvatarInitials name={name} src={team.teamicon} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                {inThisClub ? (
                  <span className="text-xs text-muted-foreground">Ya está en este club</span>
                ) : inOtherClub ? (
                  <span className="text-xs text-muted-foreground">Ya pertenece a otro club</span>
                ) : pending ? (
                  <span className="text-xs text-muted-foreground">Solicitud pendiente</span>
                ) : (
                  <Button size="sm" disabled={busy === name} onClick={() => void request(team)}>
                    Solicitar ingreso
                  </Button>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">Un director del club tendrá que aprobar la solicitud.</p>
        </div>
      )}
    </div>
  );
}

export default function JoinClubPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Invitación a un club" />
      <Suspense fallback={null}>
        <JoinClubContent />
      </Suspense>
    </div>
  );
}
