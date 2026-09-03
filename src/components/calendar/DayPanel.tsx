"use client";

import { Check, MapPin, Plus, Send, Trophy, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveUidByName } from "@/lib/actions/team";
import { sendAttendanceNotification } from "@/lib/actions/notify";
import type { Team, TrainingDay } from "@/lib/types";

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
  myName,
  onAnswer,
}: {
  team: Team;
  fecha: string;
  day: TrainingDay | null;
  isCoach: boolean;
  myName: string;
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
  const accepted = day.accepted_players.includes(myName);
  const declined = day.declined_players.includes(myName);
  const noAnswerCount =
    team.userplayers.length - day.accepted_players.length - day.declined_players.length;
  const noAnswerNames = team.userplayers.filter(
    (n) => !day.accepted_players.includes(n) && !day.declined_players.includes(n),
  );

  const sendConvocatoria = async () => {
    setSending(true);
    try {
      const uids = (
        await Promise.all(noAnswerNames.map((n) => resolveUidByName(n)))
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2 text-lg">
          <span className="flex items-center gap-2">
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

        {!isCoach && (
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
                  <Check className="size-3" /> {day.accepted_players.length}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <X className="size-3" /> {day.declined_players.length}
                </Badge>
                <Badge variant="outline">{noAnswerCount} sin responder</Badge>
              </div>
              {noAnswerCount > 0 && (
                <Button size="sm" variant="outline" disabled={sending} onClick={() => void sendConvocatoria()}>
                  <Send className="size-3.5" />
                  {sending ? "Enviando…" : `Convocar (${noAnswerCount})`}
                </Button>
              )}
            </TabsContent>
            <TabsContent value="rollcall" className="pt-3">
              <RollCall team={team} day={day} />
            </TabsContent>
            {isMatch && (
              <TabsContent value="lineup" className="pt-3">
                {day.lineupId && team.lineups[day.lineupId] ? (
                  <LineupEditor team={team} lineup={team.lineups[day.lineupId]} />
                ) : (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      Este partido todavía no tiene ninguna alineación publicada.
                    </p>
                    <Button className="w-full" render={<Link href="/team/lineups" />}>
                      Crear o elegir alineación
                    </Button>
                  </div>
                )}
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
