"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { AvatarInitials } from "@/components/AvatarInitials";
import { SearchInput } from "@/components/SearchInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveUidByName, setAttendance } from "@/lib/actions/team";
import type { Team, TrainingDay } from "@/lib/types";

/** Pasar lista del coach: búsqueda + filas de 44px con AttendanceToggle. */
export function RollCall({ team, day }: { team: Team; day: TrainingDay }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const status = (name: string): "accepted" | "declined" | "none" =>
    day.accepted_players.includes(name)
      ? "accepted"
      : day.declined_players.includes(name)
        ? "declined"
        : "none";

  const players = useMemo(
    () => team.userplayers.filter((n) => n.toLowerCase().includes(search.toLowerCase())),
    [team.userplayers, search],
  );

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

  return (
    <div className="space-y-2">
      {team.userplayers.length > 8 && (
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar jugador…" />
      )}
      <ScrollArea className="h-72 pr-2">
        <div className="space-y-1">
          {players.map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 rounded-lg py-1 pr-1 pl-2 hover:bg-muted/50"
            >
              <AvatarInitials name={name} size="sm" />
              <span className="flex-1 truncate text-sm">{name}</span>
              <AttendanceToggle
                value={status(name)}
                onChange={(s) => void mark(name, s)}
                disabled={busy === name}
                size="lg"
              />
            </div>
          ))}
          {players.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
