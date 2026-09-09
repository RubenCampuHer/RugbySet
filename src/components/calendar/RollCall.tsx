"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { AvatarInitials } from "@/components/AvatarInitials";
import { SearchInput } from "@/components/SearchInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { setAttendance } from "@/lib/actions/team";
import type { Team, TrainingDay } from "@/lib/types";

/**
 * Pasar lista del coach: búsqueda + filas de 44px con AttendanceToggle.
 * Rosters por uid (2026-09-04): team.userplayers es {uid: true} — el nombre
 * a mostrar se resuelve en vivo vía publicProfiles (useProfilesByUid), la
 * misma fuente que usa TeamManager para el resto del equipo.
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

  const players = useMemo(
    () =>
      uids
        .map((uid) => ({
          uid,
          name: profiles[uid]?.nameSurname || "",
          icon: profiles[uid]?.usericon ?? null,
        }))
        .filter(({ name }) => name.toLowerCase().includes(search.toLowerCase())),
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

  return (
    <div className="space-y-2">
      {uids.length > 8 && (
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar jugador…" />
      )}
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
            <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
