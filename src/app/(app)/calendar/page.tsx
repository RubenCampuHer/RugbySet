"use client";

import { Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/hooks/useTeam";
import { useTrainings } from "@/hooks/useTrainings";
import {
  deleteTrainingDay,
  resolveUidByName,
  setAttendance,
  upsertTrainingDay,
} from "@/lib/actions/team";
import { sendAttendanceNotification } from "@/lib/actions/notify";
import { cn } from "@/lib/utils";
import type { Team, TrainingDay } from "@/lib/types";

// Formato de fecha compartido con Android: "dd/MM/yyyy"
function toKey(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Panel del jugador: confirmar/rechazar SU asistencia. */
function PlayerAttendance({
  team,
  day,
  myName,
  myUid,
}: {
  team: Team;
  day: TrainingDay;
  myName: string;
  myUid: string;
}) {
  const [busy, setBusy] = useState(false);
  const accepted = day.accepted_players.includes(myName);
  const declined = day.declined_players.includes(myName);

  const answer = async (status: "accepted" | "declined") => {
    setBusy(true);
    try {
      await setAttendance({
        teamname: team.teamname!,
        fecha: day.fecha!,
        playerName: myName,
        playerUid: myUid,
        status,
      });
      toast.success(status === "accepted" ? "Asistencia confirmada 💪" : "Asistencia rechazada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">¿Asistirás?</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          className={cn(
            accepted
              ? "bg-accent text-accent-foreground hover:bg-accent/80"
              : "bg-muted text-muted-foreground hover:bg-accent/40",
          )}
          onClick={() => void answer("accepted")}
        >
          ✓ Sí voy
        </Button>
        <Button
          size="sm"
          disabled={busy}
          variant={declined ? "destructive" : "secondary"}
          onClick={() => void answer("declined")}
        >
          ✗ No voy
        </Button>
      </div>
    </div>
  );
}

/** Panel del coach: pasar lista + convocatoria. */
function CoachRollCall({ team, day }: { team: Team; day: TrainingDay }) {
  const { profile, firebaseUser } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const status = (name: string) =>
    day.accepted_players.includes(name)
      ? "accepted"
      : day.declined_players.includes(name)
        ? "declined"
        : "none";

  const noAnswer = team.userplayers.filter((n) => status(n) === "none");

  const mark = async (name: string, s: "accepted" | "declined") => {
    setBusy(name);
    try {
      const uid = await resolveUidByName(name);
      if (!uid) throw new Error(`Sin perfil para ${name}`);
      await setAttendance({
        teamname: team.teamname!,
        fecha: day.fecha!,
        playerName: name,
        playerUid: uid,
        status: s,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  };

  const sendConvocatoria = async () => {
    setSending(true);
    try {
      const uids = (
        await Promise.all(noAnswer.map((n) => resolveUidByName(n)))
      ).filter((u): u is string => u !== null);
      const { sent } = await sendAttendanceNotification({
        teamName: team.teamname!,
        trainingDate: day.fecha!,
        trainingTime: `${day.horaInicio} - ${day.horaFin}`,
        recipientUserIds: uids,
        senderUserId: firebaseUser?.uid ?? "",
        senderUsername: profile?.username ?? "",
      });
      toast.success(`Convocatoria enviada a ${uids.length} jugadores (${sent} push)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Pasar lista{" "}
          <span className="text-muted-foreground">
            (✓ {day.accepted_players.length} · ✗ {day.declined_players.length} ·
            — {noAnswer.length})
          </span>
        </p>
        {noAnswer.length > 0 && (
          <Button size="sm" variant="outline" disabled={sending} onClick={() => void sendConvocatoria()}>
            <Send className="size-3.5" />
            {sending ? "Enviando…" : `Convocar (${noAnswer.length})`}
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {team.userplayers.map((name) => {
          const s = status(name);
          return (
            <div key={name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
              <span className="truncate text-sm">{name}</span>
              <span className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  aria-label={`${name} sí asiste`}
                  disabled={busy === name}
                  className={cn(
                    "size-7 rounded-full",
                    s === "accepted"
                      ? "bg-accent text-accent-foreground hover:bg-accent/80"
                      : "bg-muted text-muted-foreground hover:bg-accent/40",
                  )}
                  onClick={() => void mark(name, "accepted")}
                >
                  ✓
                </Button>
                <Button
                  size="icon"
                  aria-label={`${name} no asiste`}
                  disabled={busy === name}
                  variant={s === "declined" ? "destructive" : "secondary"}
                  className="size-7 rounded-full"
                  onClick={() => void mark(name, "declined")}
                >
                  ✗
                </Button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Editor del coach: crear/editar el día (horas + entreno) y borrarlo. */
function CoachDayEditor({
  team,
  fecha,
  day,
}: {
  team: Team;
  fecha: string;
  day: TrainingDay | null;
}) {
  const { trainings } = useTrainings();
  const [horaInicio, setHoraInicio] = useState(day?.horaInicio ?? "18:00");
  const [horaFin, setHoraFin] = useState(day?.horaFin ?? "19:30");
  const [trainingName, setTrainingName] = useState(day?.training?.name ?? "");
  const [eventType, setEventType] = useState<"TRAINING" | "MATCH">(
    day?.eventType === "MATCH" ? "MATCH" : "TRAINING",
  );
  const [eventName, setEventName] = useState(day?.nameTrainingDay ?? "");
  const [location, setLocation] = useState(day?.location ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!TIME_RE.test(horaInicio) || !TIME_RE.test(horaFin)) {
      toast.error("Horas inválidas (formato HH:mm)");
      return;
    }
    if (horaInicio >= horaFin) {
      toast.error("La hora de inicio debe ser anterior a la de fin");
      return;
    }
    const training = trainings.find((t) => t.name === trainingName);
    if (!training) {
      toast.error("Elige un entreno");
      return;
    }
    setBusy(true);
    try {
      await upsertTrainingDay(
        team.teamname!,
        {
          fecha,
          horaInicio,
          horaFin,
          training,
          nameTrainingDay: eventName,
          eventType,
          location,
        },
        team.trainingdays,
      );
      toast.success(day ? "Entreno actualizado" : "Entreno creado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar el entreno del ${fecha}?`)) return;
    setBusy(true);
    try {
      await deleteTrainingDay(team.teamname!, fecha, team.trainingdays);
      toast.success("Entreno borrado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo borrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-sm font-medium">
        {day ? "Editar entreno (entrenador)" : "Añadir entreno (entrenador)"}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={eventType === "TRAINING" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setEventType("TRAINING")}
        >
          🏉 Entreno
        </Button>
        <Button
          type="button"
          size="sm"
          variant={eventType === "MATCH" ? "default" : "outline"}
          className={cn("flex-1", eventType === "MATCH" && "bg-amber-500 text-white hover:bg-amber-500/90")}
          onClick={() => setEventType("MATCH")}
        >
          🏆 Partido
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="eventName" className="text-xs">Nombre del evento (opcional)</Label>
        <Input id="eventName" value={eventName} placeholder="p.ej. Vs. Leones RC"
          onChange={(e) => setEventName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="horaInicio" className="text-xs">Inicio</Label>
          <Input id="horaInicio" value={horaInicio} placeholder="18:00"
            onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="horaFin" className="text-xs">Fin</Label>
          <Input id="horaFin" value={horaFin} placeholder="19:30"
            onChange={(e) => setHoraFin(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="location" className="text-xs">Ubicación (opcional)</Label>
        <Input id="location" value={location} placeholder="p.ej. Campo Municipal"
          onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="training" className="text-xs">Entreno</Label>
        <select
          id="training"
          value={trainingName}
          onChange={(e) => setTrainingName(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="" className="bg-card">— Elegir entreno —</option>
          {trainings.map((t) => (
            <option key={t.name} value={t.name ?? ""} className="bg-card">
              {t.name} ({t.tiempoTotal ?? "?"} min)
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {day ? "Guardar cambios" : "Crear entreno"}
        </Button>
        {day && (
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
            <Trash2 className="size-3.5" /> Borrar día
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { profile, firebaseUser } = useAuth();
  const { team, hasTeam, loading } = useTeam();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const daysByFecha = useMemo(() => {
    const map = new Map<string, TrainingDay>();
    for (const td of team?.trainingdays ?? []) {
      if (td.fecha) map.set(td.fecha, td);
    }
    return map;
  }, [team]);

  const attended = useMemo(
    () => new Set(profile?.assistedTrainingDays ?? []),
    [profile],
  );

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!hasTeam || team === null) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <EmptyState
          emoji="📅"
          title="Sin calendario de equipo"
          hint="Únete a un equipo desde la app Android para ver sus entrenos."
        />
      </div>
    );
  }

  const isCoach = team.usercoach === firebaseUser?.uid;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
    setSelected(null);
  };

  const selectedDay = selected ? (daysByFecha.get(selected) ?? null) : null;
  const myName = profile?.nameSurname ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Calendario</h1>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="size-10" aria-label="Mes anterior" onClick={prevMonth}>←</Button>
        <p className="font-medium">{MONTHS[month]} {year}</p>
        <Button variant="outline" size="icon" className="size-10" aria-label="Mes siguiente" onClick={nextMonth}>→</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = toKey(year, month, day);
          const daySession = daysByFecha.get(key);
          const hasTraining = daySession !== undefined;
          const isMatch = daySession?.eventType === "MATCH";
          const wasAttended = attended.has(key);
          return (
            <button
              key={key}
              type="button"
              // El coach puede seleccionar cualquier día (para crear); el
              // jugador solo días con entreno — como en Android.
              onClick={() => setSelected(hasTraining || isCoach ? key : null)}
              className={cn(
                "aspect-square rounded-md text-sm",
                isMatch
                  ? "bg-amber-500 font-semibold text-white hover:bg-amber-500/90"
                  : hasTraining
                    ? "bg-primary font-semibold text-primary-foreground hover:bg-[#4F46E5]"
                    : "hover:bg-muted",
                wasAttended && "ring-2 ring-accent",
                selected === key && "outline-2 outline-offset-2 outline-ring",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        ■ entreno · ■ partido · anillo verde = asististe
        {isCoach && " · toca cualquier día para añadir entreno"}
      </p>

      {selected && (selectedDay || isCoach) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between text-lg">
              <span className="flex items-center gap-2">
                {selectedDay?.eventType === "MATCH" && (
                  <Badge className="border-transparent bg-amber-500/15 text-amber-500">
                    🏆 Partido
                  </Badge>
                )}
                {selectedDay?.nameTrainingDay || (selectedDay
                  ? selectedDay.training?.name || "Entreno"
                  : `Sin entreno el ${selected}`)}
              </span>
              {selectedDay && (
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedDay.horaInicio}–{selectedDay.horaFin}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selectedDay?.location && (
              <p className="text-muted-foreground">📍 {selectedDay.location}</p>
            )}
            {selectedDay?.training?.name && (
              <p>
                Entreno:{" "}
                <Link
                  className="font-medium text-[#818CF8] underline-offset-4 hover:underline"
                  href={`/trainings/detail?name=${encodeURIComponent(selectedDay.training.name)}`}
                >
                  {selectedDay.training.name}
                </Link>{" "}
                ({selectedDay.training.tiempoTotal ?? "?"} min)
              </p>
            )}

            {selectedDay && (
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">
                  ✓ {selectedDay.accepted_players.length} · ✗{" "}
                  {selectedDay.declined_players.length}
                </Badge>
              </div>
            )}

            {/* Jugador: su propia asistencia */}
            {selectedDay && !isCoach && firebaseUser && myName && (
              <PlayerAttendance
                team={team}
                day={selectedDay}
                myName={myName}
                myUid={firebaseUser.uid}
              />
            )}

            {/* Coach: pasar lista + convocatoria */}
            {selectedDay && isCoach && <CoachRollCall team={team} day={selectedDay} />}

            {/* Coach: crear/editar/borrar el día */}
            {isCoach && (
              <CoachDayEditor
                key={selected}
                team={team}
                fecha={selected}
                day={selectedDay}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
