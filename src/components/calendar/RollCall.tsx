"use client";

import { CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SearchInput } from "@/components/SearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { setAttendance, setAttendanceBulk } from "@/lib/actions/team";
import type { Team, TrainingDay } from "@/lib/types";

/**
 * Pasar lista del coach: contadores en vivo, búsqueda, filas de 44px con
 * AttendanceToggle y "marcar a los que faltan" en bloque (2026-09-23).
 * Rosters por uid (2026-09-04): team.userplayers es {uid: true} — el nombre
 * a mostrar se resuelve en vivo vía publicProfiles (useProfilesByUid).
 */
export function RollCall({ team, day }: { team: Team; day: TrainingDay }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const uids = useMemo(() => Object.keys(team.userplayers), [team.userplayers]);
  const profiles = useProfilesByUid(uids);

  const status = (uid: string): "accepted" | "declined" | "none" =>
    day.accepted_players[uid] === true
      ? "accepted"
      : day.declined_players[uid] === true
        ? "declined"
        : "none";

  const came = uids.filter((u) => status(u) === "accepted").length;
  const missed = uids.filter((u) => status(u) === "declined").length;
  const unmarked = uids.filter((u) => status(u) === "none");

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

  const mark = async (uid: string, s: "accepted" | "declined") => {
    setBusy(uid);
    try {
      await setAttendance({
        teamname: team.teamname!,
        fecha: day.fecha!,
        playerUid: uid,
        status: s,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(null);
    }
  };

  const markRest = async () => {
    try {
      const { marked, personalFailed } = await setAttendanceBulk({
        teamname: team.teamname!,
        fecha: day.fecha!,
        playerUids: unmarked,
        status: "accepted",
      });
      toast.success(`${marked} ${marked === 1 ? "jugador marcado" : "jugadores marcados"} como presentes`, {
        description:
          personalFailed > 0
            ? `En ${personalFailed} no se pudo actualizar su historial personal (tienen otro equipo activo).`
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
        <Badge variant="outline">{missed} no</Badge>
        <Badge variant={unmarked.length > 0 ? "secondary" : "outline"}>
          {unmarked.length} sin marcar
        </Badge>
      </div>

      {unmarked.length > 0 && (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline" className="w-full">
              <CheckCheck className="size-4" /> Marcar a los {unmarked.length} sin marcar como presentes
            </Button>
          }
          title={`¿Marcar a ${unmarked.length} como presentes?`}
          description="Solo afecta a quien no tiene respuesta ni marca. Después puedes corregir a cualquiera tocando su fila."
          confirmLabel="Marcar presentes"
          onConfirm={markRest}
        />
      )}

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar jugador…" />
      <ScrollArea className="h-72 pr-2">
        <div className="space-y-1">
          {players.map(({ uid, name, icon }) => (
            <div
              key={uid}
              className="flex items-center gap-2 rounded-lg py-1 pr-1 pl-2 hover:bg-muted/50"
            >
              {/* Ficha de persona (2026-09-09) — solo foto+nombre, el toggle queda fuera */}
              <Link
                href={`/profile/detail?uid=${encodeURIComponent(uid)}`}
                className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80"
              >
                <AvatarInitials name={name || "Jugador"} src={icon} size="sm" />
                <span className="flex-1 truncate text-sm">{name || "Jugador"}</span>
              </Link>
              <AttendanceToggle
                value={status(uid)}
                onChange={(s) => void mark(uid, s)}
                disabled={busy === uid}
                size="lg"
              />
            </div>
          ))}
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
