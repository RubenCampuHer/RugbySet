"use client";

import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  PartyPopper,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ListRowsSkeleton } from "@/components/skeletons";
import { AttendanceComparisonCard } from "@/components/stats/AttendanceComparisonCard";
import { CreateTeamDialog } from "@/components/team/CreateTeamDialog";
import { JoinTeamForm } from "@/components/team/JoinTeamForm";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClub } from "@/hooks/useClub";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTeam } from "@/hooks/useTeam";
import { sendAttendanceNotification } from "@/lib/actions/notify";
import { setAttendance } from "@/lib/actions/team";
import { answerCounts, noAnswerUids, playerPending, relativeDayLabel, staffHome, type StaffTask } from "@/lib/agenda";
import { keyToParam } from "@/lib/calendar";
import { isAdmin, isCoach, isTeamCoach } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Team, TrainingDay } from "@/lib/types";

function eventTitle(day: TrainingDay): string {
  return day.nameTrainingDay || day.training?.name || (day.eventType === "MATCH" ? "Partido" : "Entreno");
}

function calendarHref(fecha: string): string {
  return `/calendar?date=${keyToParam(fecha)}`;
}

function StaffTaskRow({ team, task }: { team: Team; task: StaffTask }) {
  const { firebaseUser, profile } = useAuth();
  const [sending, setSending] = useState(false);
  const isMatch = task.day.eventType === "MATCH";

  const nudge = async () => {
    setSending(true);
    try {
      const recipients = noAnswerUids(team, task.day);
      const { sent } = await sendAttendanceNotification({
        teamName: team.teamname!,
        trainingDate: task.fecha,
        trainingTime: `${task.day.horaInicio} - ${task.day.horaFin}`,
        recipientUserIds: recipients,
        senderUserId: firebaseUser?.uid ?? "",
        senderUsername: profile?.username ?? "",
        isMatch,
      });
      toast.success(
        `Aviso enviado a ${recipients.length} ${recipients.length === 1 ? "jugador" : "jugadores"}`,
        { description: `${sent} lo reciben en el móvil; el resto lo verá en sus avisos.` },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el aviso");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium">
          {isMatch && <Trophy className="size-4 shrink-0 text-warning" />}
          {eventTitle(task.day)}
        </p>
        <p className="text-xs text-muted-foreground">
          {relativeDayLabel(task.fecha)} · {task.day.horaInicio} ·{" "}
          {task.kind === "unanswered"
            ? `${task.count} sin responder`
            : `${task.count} sin marcar en la lista`}
        </p>
      </div>
      {task.kind === "unanswered" ? (
        <Button size="sm" variant="outline" disabled={sending} onClick={() => void nudge()}>
          <Send className="size-3.5" /> {sending ? "Enviando…" : "Avisar"}
        </Button>
      ) : (
        <Link href={calendarHref(task.fecha)} className={buttonVariants({ size: "sm", variant: "outline" })}>
          <CalendarCheck className="size-3.5" /> Pasar lista
        </Link>
      )}
    </div>
  );
}

function StaffSection({ team }: { team: Team }) {
  const { tasks, nextMatch } = useMemo(() => staffHome(team), [team]);
  const playerCount = Object.keys(team.userplayers).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Te falta por hacer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PartyPopper className="size-4" /> Todo al día: nadie pendiente de responder ni de marcar.
            </p>
          ) : (
            tasks.map((t) => <StaffTaskRow key={`${t.kind}-${t.fecha}`} team={team} task={t} />)
          )}
        </CardContent>
      </Card>

      {nextMatch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-warning" /> Próximo partido
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-medium">{eventTitle(nextMatch.day)}</p>
              <p className="text-muted-foreground">
                {relativeDayLabel(nextMatch.day.fecha!)} · {nextMatch.day.horaInicio}
                {nextMatch.day.location ? ` · ${nextMatch.day.location}` : ""}
              </p>
              <p className="text-muted-foreground">
                Van {answerCounts(team, nextMatch.day).going} de {playerCount}
              </p>
            </div>
            <Link href={calendarHref(nextMatch.day.fecha!)} className={buttonVariants({ size: "sm" })}>
              Ver partido
            </Link>
          </CardContent>
        </Card>
      )}

      {playerCount === 0 && (
        <Card>
          <CardContent className="py-4 text-sm">
            <p className="font-medium">Tu equipo aún no tiene jugadores</p>
            <p className="text-muted-foreground">
              Comparte el código del equipo desde la pantalla Equipo para que se unan.
            </p>
            <Link href="/team" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-3")}>
              <Users className="size-3.5" /> Ir a Equipo
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function PlayerSection({ team, uid }: { team: Team; uid: string }) {
  const pending = useMemo(() => playerPending(team, uid), [team, uid]);
  const [busy, setBusy] = useState<string | null>(null);

  const answer = async (day: TrainingDay, status: "accepted" | "declined") => {
    setBusy(day.fecha!);
    try {
      await setAttendance({ teamname: team.teamname!, fecha: day.fecha!, playerUid: uid, status });
      toast.success(status === "accepted" ? "¡Apuntado!" : "Respuesta guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar tu respuesta");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Esta semana</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PartyPopper className="size-4" /> Has respondido a todo lo de los próximos días.
            </p>
          ) : (
            pending.map(({ day }) => (
              <div key={day.fecha} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                <Link href={calendarHref(day.fecha!)} className="min-w-0 flex-1 hover:opacity-80">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {day.eventType === "MATCH" && <Trophy className="size-4 shrink-0 text-warning" />}
                    {eventTitle(day)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relativeDayLabel(day.fecha!)} · {day.horaInicio}–{day.horaFin}
                    {day.location ? ` · ${day.location}` : ""}
                  </p>
                </Link>
                <AttendanceToggle
                  value="none"
                  onChange={(s) => void answer(day, s)}
                  disabled={busy === day.fecha}
                  size="sm"
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <AttendanceComparisonCard team={team} uid={uid} />
    </>
  );
}

function DirectorCard() {
  const { club } = useClub();
  if (!club) return null;
  const pendingTeams = Object.entries(club.pendingTeams).filter(([, v]) => v).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" /> {club.clubname ?? "Tu club"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="space-y-1">
          <p>{club.teams.length} {club.teams.length === 1 ? "equipo" : "equipos"}</p>
          {pendingTeams > 0 && (
            <Badge variant="outline">
              {pendingTeams} {pendingTeams === 1 ? "solicitud pendiente" : "solicitudes pendientes"}
            </Badge>
          )}
        </div>
        <Link href="/club" className={buttonVariants({ size: "sm", variant: "outline" })}>
          Gestionar club
        </Link>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { firebaseUser, profile } = useAuth();
  const { team, hasTeam, loading } = useTeam();
  const { teams: myTeams, loading: loadingMyTeams } = useMyTeams();
  const uid = firebaseUser?.uid ?? "";
  const firstName = profile?.nameSurname?.split(" ")[0];

  if (loading || profile === null || (!hasTeam && loadingMyTeams)) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader title="Inicio" />
        <ListRowsSkeleton rows={4} />
      </div>
    );
  }

  const isDirector = Boolean(profile?.directorOfClubId);
  const isStaffHere = team != null && (isTeamCoach(team, uid) || isAdmin(profile));
  const isPlayerHere = team != null && team.userplayers[uid] === true;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={firstName ? `Hola, ${firstName}` : "Inicio"} />
      {team && (
        <p className="-mt-2 text-sm text-muted-foreground">
          {team.teamname}
          {isStaffHere ? " · Entrenas aquí" : isPlayerHere ? " · Juegas aquí" : ""}
        </p>
      )}

      {isDirector && <DirectorCard />}

      {!team ? (
        myTeams.length > 0 ? (
          <ListRowsSkeleton rows={3} />
        ) : (
          <div className="space-y-4">
            <EmptyState
              icon={Users}
              title="Todavía no estás en ningún equipo"
              hint="Pide el código a tu entrenador para unirte, o crea tu equipo si lo llevas tú."
            />
            <JoinTeamForm />
            {(isCoach(profile) || isAdmin(profile)) && (
              <div className="mx-auto max-w-sm">
                <CreateTeamDialog className="w-full" />
              </div>
            )}
          </div>
        )
      ) : (
        <>
          {isStaffHere && <StaffSection team={team} />}
          {isPlayerHere && <PlayerSection team={team} uid={uid} />}
          <div className="grid grid-cols-2 gap-2">
            <Link href="/calendar" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full")}>
              <CalendarDays className="size-4" /> Calendario
            </Link>
            <Link href="/trainings" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full")}>
              <ClipboardList className="size-4" /> Entrenos
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
