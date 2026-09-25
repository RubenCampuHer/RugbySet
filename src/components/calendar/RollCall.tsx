"use client";

import { Check, CheckCheck, Ellipsis, ListChecks, X } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchInput } from "@/components/SearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { setAttendanceMarks } from "@/lib/actions/team";
import { ATTENDANCE_MARK_LABEL, attendanceMark, type AttendanceMark } from "@/lib/attendance";
import type { Team, TrainingDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const RESPONSE_HINT = { accepted: "Dijo que sí", declined: "Dijo que no", none: "Sin responder" } as const;
const EXTRA_MARKS: AttendanceMark[] = ["late", "injured", "excused"];

/**
 * Pasar lista del coach con asistencia REAL (paso 2 Kanteo, 2026-09-25): la
 * marca va a eventData/{día}/attendance y ya no pisa la respuesta del jugador
 * (accepted/declined_players), que se muestra como pista bajo su nombre.
 * Presente/Faltó a un toque; Tarde/Lesionado/Justificado en el menú.
 * Rosters por uid: nombres en vivo vía publicProfiles (useProfilesByUid).
 */
export function RollCall({ team, day }: { team: Team; day: TrainingDay }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const uids = useMemo(() => Object.keys(team.userplayers), [team.userplayers]);
  const profiles = useProfilesByUid(uids);

  const markOf = (uid: string) => attendanceMark(team, day, uid);
  const response = (uid: string): keyof typeof RESPONSE_HINT =>
    day.accepted_players[uid] === true ? "accepted" : day.declined_players[uid] === true ? "declined" : "none";

  const came = uids.filter((u) => markOf(u) === "present" || markOf(u) === "late").length;
  const missed = uids.filter((u) => markOf(u) === "absent").length;
  const excused = uids.filter((u) => markOf(u) === "injured" || markOf(u) === "excused").length;
  const unmarked = uids.filter((u) => !markOf(u));
  const unmarkedAnswered = unmarked.filter((u) => response(u) !== "none");

  const players = useMemo(
    () =>
      uids
        .map((uid) => ({
          uid,
          name: profiles[uid]?.nameSurname || "",
          icon: profiles[uid]?.usericon ?? null,
        }))
        .filter(({ name }) => name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [uids, profiles, search],
  );

  const save = (marks: Record<string, AttendanceMark | null>) =>
    setAttendanceMarks({ teamname: team.teamname!, fecha: day.fecha!, marks });

  const mark = async (uid: string, value: AttendanceMark | null) => {
    setBusy(uid);
    try {
      await save({ [uid]: value });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  };

  const bulk = async (marks: Record<string, AttendanceMark>, how: string) => {
    try {
      const { marked, personalFailed } = await save(marks);
      toast.success(`${marked} ${marked === 1 ? "jugador marcado" : "jugadores marcados"} ${how}`, {
        description:
          personalFailed > 0
            ? `En ${personalFailed} no se pudo actualizar su historial en el móvil (tienen otro equipo activo).`
            : undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
        <Badge variant="outline">{came} vinieron</Badge>
        <Badge variant="outline">{missed} faltaron</Badge>
        {excused > 0 && <Badge variant="outline">{excused} justificadas</Badge>}
        <Badge variant={unmarked.length > 0 ? "secondary" : "outline"}>{unmarked.length} sin marcar</Badge>
      </div>

      {unmarked.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline" className="w-full">
                <CheckCheck className="size-4" />
                {unmarked.length === 1 ? "Marcar presente al que falta" : `Todos presentes (${unmarked.length})`}
              </Button>
            }
            title={`¿Marcar a ${unmarked.length} como presentes?`}
            description="Solo afecta a quien no tiene marca. Después puedes corregir a cualquiera en su fila."
            confirmLabel="Marcar presentes"
            onConfirm={() => bulk(Object.fromEntries(unmarked.map((u) => [u, "present" as const])), "como presentes")}
          />
          {unmarkedAnswered.length > 0 && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" className="w-full">
                  <ListChecks className="size-4" /> Según sus respuestas ({unmarkedAnswered.length})
                </Button>
              }
              title="¿Marcar según lo que respondieron?"
              description={'Quien dijo "sí" queda presente y quien dijo "no", ausente. Los que no respondieron siguen sin marcar.'}
              confirmLabel="Marcar"
              onConfirm={() =>
                bulk(
                  Object.fromEntries(
                    unmarkedAnswered.map((u) => [u, response(u) === "accepted" ? ("present" as const) : ("absent" as const)]),
                  ),
                  "según sus respuestas",
                )
              }
            />
          )}
        </div>
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar jugador…" />
      <ScrollArea className="h-72 pr-2">
        <div className="space-y-1">
          {players.map(({ uid, name, icon }) => {
            const current = markOf(uid);
            const extra = current && EXTRA_MARKS.includes(current) ? current : null;
            return (
              <div key={uid} className="flex items-center gap-2 rounded-lg py-1 pr-1 pl-2 hover:bg-muted/50">
                {/* Ficha de persona (2026-09-09) — solo foto+nombre, los botones quedan fuera */}
                <Link
                  href={`/profile/detail?uid=${encodeURIComponent(uid)}`}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80"
                >
                  <AvatarInitials name={name || "Jugador"} src={icon} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{name || "Jugador"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {RESPONSE_HINT[response(uid)]}
                      {extra && (
                        <>
                          {" · "}
                          <span className={extra === "late" ? "text-warning" : "text-brand"}>
                            {ATTENDANCE_MARK_LABEL[extra]}
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </Link>
                <Button
                  type="button"
                  size="icon-xl"
                  variant={current === "present" ? "default" : "secondary"}
                  className={cn(current === "present" && "bg-accent text-accent-foreground hover:bg-accent/85")}
                  aria-label="Presente"
                  aria-pressed={current === "present"}
                  disabled={busy === uid}
                  onClick={() => void mark(uid, current === "present" ? null : "present")}
                >
                  <Check className="size-5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xl"
                  variant={current === "absent" ? "destructive" : "secondary"}
                  aria-label="Faltó"
                  aria-pressed={current === "absent"}
                  disabled={busy === uid}
                  onClick={() => void mark(uid, current === "absent" ? null : "absent")}
                >
                  <X className="size-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="Más opciones de asistencia"
                    disabled={busy === uid}
                    render={<Button type="button" size="icon-xl" variant={extra ? "outline" : "ghost"} />}
                  >
                    <Ellipsis className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      {EXTRA_MARKS.map((m) => (
                        <DropdownMenuItem key={m} onClick={() => void mark(uid, m)}>
                          {ATTENDANCE_MARK_LABEL[m]}
                          {current === m && <Check className="ml-auto size-4 text-brand" />}
                        </DropdownMenuItem>
                      ))}
                      {current && <DropdownMenuItem onClick={() => void mark(uid, null)}>Quitar marca</DropdownMenuItem>}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          {players.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {uids.length === 0 ? "El equipo aún no tiene jugadores." : "Nadie con ese nombre."}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
