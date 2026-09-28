"use client";

import { CalendarDays, Lock, MapPin, Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ListRowsSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClub } from "@/hooks/useClub";
import { useClubTeams } from "@/hooks/useClubTeams";
import { createClubEvent, deleteClubEvent, newClubEventId, type ClubEventInput } from "@/lib/actions/club-calendar";
import { sendClubMessage } from "@/lib/actions/notify";
import { answerCounts, clubAgendaGroups, relativeDayLabel } from "@/lib/agenda";
import { inputValueToFecha } from "@/lib/calendar";
import { recipientsByTeam } from "@/lib/club-notify";
import { isClubDirector } from "@/lib/permissions";
import type { Club, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

function TeamChips({ names, selected, onToggle }: { names: string[]; selected: Set<string>; onToggle: (n: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {names.map((name) => (
        <label key={name} className="cursor-pointer">
          <input type="checkbox" className="peer sr-only" checked={selected.has(name)} onChange={() => onToggle(name)} />
          <Badge
            variant={selected.has(name) ? "default" : "outline"}
            className="min-h-8 px-3 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
          >
            {name}
          </Badge>
        </label>
      ))}
    </div>
  );
}

const toggleIn = (set: Set<string>, name: string) => {
  const next = new Set(set);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
};

/** Crear un evento del club en varios equipos a la vez, con aviso opcional. */
function NewClubEventDialog({
  open,
  onOpenChange,
  club,
  teams,
  uid,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  club: Club;
  teams: Team[];
  uid: string;
  username: string;
}) {
  const names = teams.map((t) => t.teamname!).filter(Boolean);
  const [date, setDate] = useState("");
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("12:00");
  const [eventType, setEventType] = useState<ClubEventInput["eventType"]>("MATCH");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const chosen = selected ?? new Set(names);
  const fecha = inputValueToFecha(date);
  const valid = Boolean(fecha && name.trim() && horaInicio && horaFin && chosen.size > 0);

  const submit = async () => {
    if (!valid || !fecha) return;
    setBusy(true);
    try {
      const input: ClubEventInput = { fecha, horaInicio, horaFin, eventType, nameTrainingDay: name, location: location || null };
      const { created, skipped } = await createClubEvent([...chosen], input, newClubEventId());
      if (created.length) toast.success(`"${name.trim()}" añadido a ${created.length} ${created.length === 1 ? "equipo" : "equipos"}`);
      if (skipped.length) toast.warning(`Ya tenían un evento ese día (no se ha tocado): ${skipped.join(", ")}`);
      if (notify && created.length) {
        const groups = recipientsByTeam(teams, new Set(created), "all", uid);
        const when = `${relativeDayLabel(fecha)} (${fecha}) · ${horaInicio}–${horaFin}${location.trim() ? ` · ${location.trim()}` : ""}`;
        const r = await sendClubMessage({
          clubId: club.clubId!,
          clubName: club.clubname ?? "el club",
          title: `Evento del club: ${name.trim()}`,
          message: `${eventType === "MATCH" ? "Partido" : "Entreno"} ${when}. Míralo en el calendario de tu equipo.`,
          groups,
          senderUserId: uid,
          senderUsername: username,
        });
        toast.success(`Aviso enviado a ${r.recipients} ${r.recipients === 1 ? "persona" : "personas"}`);
      }
      onOpenChange(false);
      setName("");
      setLocation("");
      setDate("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el evento");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo evento del club</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["MATCH", "TRAINING"] as const).map((t) => (
              <Button key={t} type="button" variant={eventType === t ? "default" : "outline"} onClick={() => setEventType(t)}>
                {t === "MATCH" ? "Partido / torneo" : "Entreno"}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="ce-name">Nombre</Label>
            <Input id="ce-name" value={name} maxLength={80} placeholder="p. ej. Torneo de otoño" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 space-y-1 sm:col-span-1">
              <Label htmlFor="ce-date">Fecha</Label>
              <Input id="ce-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ce-start">Inicio</Label>
              <Input id="ce-start" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ce-end">Fin</Label>
              <Input id="ce-end" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ce-location">Ubicación (opcional)</Label>
            <Input id="ce-location" value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Equipos</Label>
            <TeamChips names={names} selected={chosen} onToggle={(n) => setSelected(toggleIn(chosen, n))} />
            <p className="text-xs text-muted-foreground">Si un equipo ya tiene un evento ese día, se deja como está.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Avisar a los equipos (jugadores, entrenadores y delegados)
          </label>
        </div>
        <DialogFooter>
          <Button disabled={busy || !valid} onClick={() => void submit()}>
            {busy ? "Creando…" : "Crear evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Calendario del club (2026-09-28): los eventos de todos los equipos en una
 * agenda por semanas, filtrable por equipo; la dirección crea eventos del
 * club en varios equipos a la vez y los borra de todos.
 */
export default function ClubCalendarPage() {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const { club, loading } = useClub();
  const { teams, loading: loadingTeams } = useClubTeams(club?.teams ?? []);
  const [mode, setMode] = useState<"upcoming" | "past">("upcoming");
  const [filter, setFilter] = useState<Set<string> | null>(null);
  const [creating, setCreating] = useState(false);

  if (loading || profile === null || (club && loadingTeams)) return <ListRowsSkeleton />;
  if (!club || !isClubDirector(club, uid, profile)) {
    return <EmptyState icon={Lock} title="Solo la dirección del club" hint="El calendario del club lo gestiona su dirección." />;
  }

  const names = teams.map((t) => t.teamname!).filter(Boolean);
  const shown = filter ?? new Set(names);
  const groups = clubAgendaGroups(teams.filter((t) => shown.has(t.teamname!)), mode);
  const clubEventTeams = (id: string) => teams.filter((t) => t.trainingdays.some((d) => d.clubEventId === id));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/club" label="Club" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="size-6" /> Calendario del club
        </h1>
        <Button onClick={() => setCreating(true)} disabled={names.length === 0}>
          <Plus /> Evento
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 py-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "upcoming" | "past")}>
            <TabsList>
              <TabsTrigger value="upcoming">Próximos</TabsTrigger>
              <TabsTrigger value="past">Pasados</TabsTrigger>
            </TabsList>
          </Tabs>
          <TeamChips names={names} selected={shown} onToggle={(n) => setFilter(toggleIn(shown, n))} />
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={mode === "upcoming" ? "Nada programado" : "Sin eventos pasados"}
          hint={mode === "upcoming" ? "Crea un evento del club o espera a que los equipos programen los suyos." : undefined}
        />
      ) : (
        groups.map((g) => (
          <Card key={g.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{g.label}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border py-0">
              {g.entries.map(({ team, day, date }) => {
                const counts = answerCounts(team, day);
                const players = Object.keys(team.userplayers).length;
                const isMatch = day.eventType === "MATCH";
                return (
                  <div key={`${team.teamname}-${day.fecha}`} className="flex items-center gap-3 py-2">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        {date.toLocaleDateString("es", { weekday: "short" }).replace(".", "")}
                      </p>
                      <p className="text-lg font-semibold leading-none">{date.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("flex items-center gap-1 truncate text-sm font-medium", day.cancelled && "line-through")}>
                        {isMatch && <Trophy className="size-3.5 shrink-0" />}
                        <span className="truncate">{day.nameTrainingDay || (isMatch ? "Partido" : "Entreno")}</span>
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="h-5 px-1.5">{team.teamname}</Badge>
                        {day.horaInicio && <span>{day.horaInicio}{day.horaFin ? `–${day.horaFin}` : ""}</span>}
                        {day.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3" /> {day.location}
                          </span>
                        )}
                        {!day.cancelled && players > 0 && <span>Van {counts.going} de {players}</span>}
                        {day.cancelled && <span className="text-destructive">Cancelado</span>}
                      </p>
                    </div>
                    {day.clubEventId && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="secondary">Club</Badge>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-lg" aria-label={`Borrar ${day.nameTrainingDay || "evento"} de todos los equipos`}>
                              <Trash2 />
                            </Button>
                          }
                          title="¿Borrar el evento del club?"
                          description={`Se borra de ${clubEventTeams(day.clubEventId).map((t) => t.teamname).join(", ")}, con sus respuestas y la asistencia de ese día.`}
                          confirmLabel="Borrar de todos"
                          destructive
                          onConfirm={async () => {
                            try {
                              const n = await deleteClubEvent(teams, day.clubEventId!);
                              toast.success(`Evento borrado de ${n} ${n === 1 ? "equipo" : "equipos"}`);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "No se pudo borrar");
                              throw e;
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      <NewClubEventDialog
        open={creating}
        onOpenChange={setCreating}
        club={club}
        teams={teams}
        uid={uid!}
        username={profile.username ?? ""}
      />
    </div>
  );
}
