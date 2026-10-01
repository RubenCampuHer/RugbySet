// Partidos jugados y como titular por jugador (2026-10-01, solo web). Sale de
// lo que ya hay por partido: convocatoria (eventData/{día}/squad), alineación
// asignada (trainingdays[].lineupId → lineups/{id}, puestos con uid) y pasar
// lista (eventData/{día}/attendance). Lógica pura, sin Firebase.
import { attendanceMark, countableDays, eventDataKey } from "./attendance";
import { parseKey } from "./calendar";
import { lineupSlots } from "./lineup";
import { matchOf } from "./match";
import type { Team, TrainingDay } from "./types";

export type PlayerMatchStats = {
  /** Partidos del equipo que cuentan (pasados, ni cancelados ni suspendidos). */
  matches: number;
  /** En la convocatoria o en la alineación. */
  called: number;
  /** En la alineación (o convocado y presente) y sin falta/lesión/justificación. */
  played: number;
  /** En el XV inicial y jugado. */
  started: number;
};

/** Partidos que cuentan: días MATCH ya pasados (desde el día siguiente), no cancelados ni suspendidos. */
export function countableMatches(team: Team, now = new Date()): TrainingDay[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return countableDays(team).filter((d) => {
    if (d.eventType !== "MATCH" || !d.fecha) return false;
    const date = parseKey(d.fecha);
    if (!date || date.getTime() >= cutoff) return false;
    return matchOf(team, d)?.status !== "abandoned";
  });
}

/** Dónde estaba el jugador en la alineación asignada a ese partido (solo puestos con uid fiable). */
function lineupRole(team: Team, day: TrainingDay, uid: string): "starter" | "bench" | null {
  const lineup = day.lineupId ? team.lineups[day.lineupId] : null;
  if (!lineup) return null;
  const slots = lineupSlots(lineup);
  if (Object.values(slots.starters).some((s) => s.uid === uid)) return "starter";
  if (Object.values(slots.bench).some((s) => s.uid === uid)) return "bench";
  return null;
}

function inSquad(team: Team, day: TrainingDay, uid: string): boolean {
  const key = day.fecha ? eventDataKey(day.fecha) : null;
  return key ? team.eventData[key]?.squad?.players[uid] === true : false;
}

export function playerMatchStats(team: Team, uid: string, now = new Date()): PlayerMatchStats {
  const stats: PlayerMatchStats = { matches: 0, called: 0, played: 0, started: 0 };
  for (const day of countableMatches(team, now)) {
    stats.matches++;
    const role = lineupRole(team, day, uid);
    const squad = inSquad(team, day, uid);
    if (!role && !squad) continue;
    stats.called++;
    const mark = attendanceMark(team, day, uid);
    const played = role
      ? mark !== "absent" && mark !== "injured" && mark !== "excused"
      : mark === "present" || mark === "late";
    if (!played) continue;
    stats.played++;
    if (role === "starter") stats.started++;
  }
  return stats;
}
