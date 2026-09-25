"use client";

import { LineupPitch, type PitchSlot } from "@/components/lineup/LineupPitch";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { lineupSlots, type LineupSlot } from "@/lib/lineup";
import type { LineupDoc } from "@/lib/types";

/**
 * Alineación de solo lectura — DayPanel (jugador, partido del día) y
 * /team/lineups. Desde 2026-09-25 sobre el campo, con el nombre ACTUAL de
 * quien tiene cuenta (players.uid → publicProfiles), no el guardado.
 */
export function LineupSummary({ lineup }: { lineup: LineupDoc }) {
  const slots = lineupSlots(lineup);
  const uids = [...Object.values(slots.starters), ...Object.values(slots.bench)]
    .map((s) => s.uid)
    .filter((u): u is string => Boolean(u));
  const profiles = useProfilesByUid(uids);
  const nameOf = (s: LineupSlot) => (s.uid && profiles[s.uid]?.nameSurname) || s.name;

  const pitch: Record<number, PitchSlot> = Object.fromEntries(
    Object.entries(slots.starters).map(([k, s]) => [Number(k), { name: nameOf(s) }]),
  );
  const bench = Object.entries(slots.bench).sort(([a], [b]) => Number(a) - Number(b));

  if (Object.keys(pitch).length === 0 && bench.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-medium">Alineación</p>
      {Object.keys(pitch).length > 0 && <LineupPitch slots={pitch} />}
      {bench.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">Suplentes</p>
          <div className="space-y-1 text-sm">
            {bench.map(([num, s]) => (
              <div key={num} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{num}</span>
                <span className="font-medium">{nameOf(s)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
