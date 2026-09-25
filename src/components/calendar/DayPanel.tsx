"use client";

import { Ban, Check, MapPin, Plus, Send, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { EventEditorSheet } from "@/components/calendar/EventEditorSheet";
import { LineupEditor } from "@/components/calendar/LineupEditor";
import { LineupSummary } from "@/components/calendar/LineupSummary";
import { RollCall } from "@/components/calendar/RollCall";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assignLineupToMatch, createLineup } from "@/lib/actions/lineup";
import { sendAttendanceNotification } from "@/lib/actions/notify";
import { answerCounts } from "@/lib/agenda";
import { parseKey } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Team, TrainingDay } from "@/lib/types";

const NO_LINEUP = "__none__";
const CREATE_LINEUP = "__create__";

/**
 * Elegir (o crear) qué alineación es la de ESTE partido — acción exclusiva
 * del Calendario desde el rediseño 2026-09-03: la alineación (roster) y su
 * asignación a un partido concreto son objetos distintos, y decidir cuál
 * es la de un partido solo se hace aquí, nunca desde /team/lineups.
 */
function MatchLineupSection({ team, fecha, day }: { team: Team; fecha: string; day: TrainingDay }) {
  const [assigning, setAssigning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const lineups = Object.values(team.lineups).sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );
  const current = day.lineupId && team.lineups[day.lineupId] ? team.lineups[day.lineupId] : null;

  const assign = async (lineupId: string | null) => {
    setAssigning(true);
    try {
      await assignLineupToMatch(team.teamname!, fecha, lineupId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo asignar la alineación");
    } finally {
      setAssigning(false);
    }
  };

  const createAndAssign = async () => {
    if (!newName.trim()) {
      toast.error("Ponle un nombre a la alineación (p.ej. \"Plan A\", \"Titular vs Leones\")");
      return;
    }
    setAssigning(true);
    try {
      const doc = await createLineup(team.teamname!, { name: newName });
      await assignLineupToMatch(team.teamname!, fecha, doc.lineupId!);
      setCreating(false);
      setNewName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la alineación");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Alineación de este partido</Label>
        <Select
          value={day.lineupId ?? NO_LINEUP}
          disabled={assigning}
          onValueChange={(v) => {
            if (!v) return;
            if (v === CREATE_LINEUP) {
              setCreating(true);
              return;
            }
            void assign(v === NO_LINEUP ? null : v);
          }}
        >
          <SelectTrigger className="min-w-0 w-full" aria-label="Alineación de este partido">
            <SelectValue className="min-w-0">
              <span className="truncate">{current ? current.name || "(sin nombre)" : "Sin alineación"}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_LINEUP}>Sin alineación</SelectItem>
            {lineups.map((l) => (
              <SelectItem key={l.lineupId} value={l.lineupId!}>
                {l.name || "(sin nombre)"}
              </SelectItem>
            ))}
            <SelectItem value={CREATE_LINEUP}>+ Crear nueva…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {creating && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={newName}
            placeholder="p.ej. Plan A, Titular vs Leones RC…"
            aria-label="Nombre de la nueva alineación"
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" disabled={assigning} onClick={() => void createAndAssign()}>
            Crear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {current && <LineupEditor team={team} lineup={current} />}
    </div>
  );
}

/**
 * Panel del día seleccionado. Sin evento: mensaje claro para el jugador
 * (antes tocar un día vacío no daba ningún feedback) o botón de alta para
 * el coach. Con evento: info + asistencia propia (jugador) o Tabs
 * Asistencia/Pasar lista (coach) — nada de acordeones nativos.
 */
export function DayPanel({
  team,
  fecha,
  day,
  isCoach,
  myUid,
  onAnswer,
}: {
  team: Team;
  fecha: string;
  day: TrainingDay | null;
  isCoach: boolean;
  myUid: string;
  onAnswer: (status: "accepted" | "declined") => void;
}) {
  const { profile, firebaseUser } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);
  const [sending, setSending] = useState(false);

  if (!day) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {isCoach ? `Sin evento el ${fecha}.` : `No hay entrenamiento programado el ${fecha}.`}
          </p>
          {isCoach && (
            <>
              <Button onClick={() => setEditorOpen(true)}>
                <Plus className="size-4" /> Añadir evento
              </Button>
              <EventEditorSheet
                team={team}
                fecha={fecha}
                day={null}
                open={editorOpen}
                onOpenChange={setEditorOpen}
              />
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const isMatch = day.eventType === "MATCH";
  const cancelled = day.cancelled === true;
  const accepted = day.accepted_players[myUid] === true;
  const declined = day.declined_players[myUid] === true;
  // Días anteriores a hoy: el jugador ve su estado pero ya no lo cambia (la
  // respuesta es también la asistencia y editarla después altera los %).
  const eventDate = parseKey(fecha);
  const today = new Date();
  const isPast =
    eventDate != null &&
    eventDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Rosters por uid (2026-09-04): sin resolver nombres — team.userplayers,
  // accepted_players y declined_players ya son mapas {uid: true}.
  const noAnswerUids = Object.keys(team.userplayers).filter(
    (uid) => day.accepted_players[uid] !== true && day.declined_players[uid] !== true,
  );
  const noAnswerCount = noAnswerUids.length;

  const sendConvocatoria = async () => {
    setSending(true);
    try {
      const { sent } = await sendAttendanceNotification({
        teamName: team.teamname!,
        trainingDate: day.fecha!,
        trainingTime: `${day.horaInicio} - ${day.horaFin}`,
        recipientUserIds: noAnswerUids,
        senderUserId: firebaseUser?.uid ?? "",
        senderUsername: profile?.username ?? "",
        isMatch,
      });
      toast.success(
        `Aviso enviado a ${noAnswerUids.length} ${noAnswerUids.length === 1 ? "jugador" : "jugadores"}`,
        { description: `${sent} lo reciben en el móvil; el resto lo verá en sus avisos.` },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2 text-lg">
          <span className={cn("flex items-center gap-2", cancelled && "text-muted-foreground line-through")}>
            {isMatch && (
              <Badge className="gap-1 border-transparent bg-warning/15 text-warning">
                <Trophy className="size-3" /> Partido
              </Badge>
            )}
            {day.nameTrainingDay || day.training?.name || "Entreno"}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {day.horaInicio}–{day.horaFin}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {cancelled && (
          <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground">
            <Ban className="size-4 shrink-0" />
            {isMatch ? "Partido cancelado" : "Entreno cancelado"}. No cuenta para la asistencia.
          </p>
        )}
        {day.location && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" /> {day.location}
          </p>
        )}
        {day.training?.name && (
          <p>
            Entreno:{" "}
            <Link
              className="font-medium text-brand underline-offset-4 hover:underline"
              href={`/trainings/detail?name=${encodeURIComponent(day.training.name)}`}
            >
              {day.training.name}
            </Link>{" "}
            ({day.training.tiempoTotal ?? "?"} min)
          </p>
        )}

        {!isCoach && !cancelled && isPast && (
          <p className="text-sm text-muted-foreground">
            {accepted ? "Asististe." : declined ? "No asististe." : "No respondiste."}
          </p>
        )}

        {!isCoach && !cancelled && !isPast && (
          <div className="space-y-2">
            <p className="font-medium">¿Asistirás?</p>
            <AttendanceToggle
              value={accepted ? "accepted" : declined ? "declined" : "none"}
              onChange={onAnswer}
              labels
            />
          </div>
        )}

        {!isCoach && isMatch && day.lineupId && team.lineups[day.lineupId] && (
          <LineupSummary lineup={team.lineups[day.lineupId]} />
        )}

        {isCoach && (
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Asistencia</TabsTrigger>
              <TabsTrigger value="rollcall">Pasar lista</TabsTrigger>
              {isMatch && <TabsTrigger value="lineup">Alineación</TabsTrigger>}
            </TabsList>
            <TabsContent value="summary" className="space-y-3 pt-3">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="gap-1">
                  <Check className="size-3" /> {answerCounts(team, day).going}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <X className="size-3" /> {answerCounts(team, day).notGoing}
                </Badge>
                <Badge variant="outline">{noAnswerCount} sin responder</Badge>
              </div>
              {noAnswerCount > 0 && !cancelled && (
                <Button size="sm" variant="outline" disabled={sending} onClick={() => void sendConvocatoria()}>
                  <Send className="size-3.5" />
                  {sending ? "Enviando…" : `Avisar a los que faltan (${noAnswerCount})`}
                </Button>
              )}
            </TabsContent>
            <TabsContent value="rollcall" className="pt-3">
              <RollCall team={team} day={day} />
            </TabsContent>
            {isMatch && (
              <TabsContent value="lineup" className="pt-3">
                <MatchLineupSection team={team} fecha={fecha} day={day} />
              </TabsContent>
            )}
          </Tabs>
        )}

        {isCoach && (
          <>
            <Button variant="outline" className="w-full" onClick={() => setEditorOpen(true)}>
              Editar evento
            </Button>
            <EventEditorSheet
              team={team}
              fecha={fecha}
              day={day}
              open={editorOpen}
              onOpenChange={setEditorOpen}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
