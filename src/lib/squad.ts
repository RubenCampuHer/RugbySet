// Convocatoria del partido (2026-09-25, solo web): Teams/{t}/eventData/{día}/squad.
// El cuerpo técnico elige a los convocados y decide en cada partido si los
// jugadores la ven (visible) y si se les avisa. Lógica pura, sin Firebase.
import { eventDataKey } from "./attendance";
import type { Team, TrainingDay } from "./types";

export type Squad = { players: string[]; visible: boolean; publishedAt: number | null };

export function squadOf(team: Team, day: TrainingDay): Squad | null {
  const key = day.fecha ? eventDataKey(day.fecha) : null;
  const raw = key ? team.eventData[key]?.squad : null;
  if (!raw) return null;
  // Solo quien sigue en el roster: si alguien sale del equipo, deja de contar.
  const players = Object.keys(raw.players).filter((uid) => team.userplayers[uid] === true);
  return { players, visible: raw.visible === true, publishedAt: raw.publishedAt ?? null };
}

/** Lo que ve el jugador: nada hasta que el cuerpo técnico la haga visible. */
export function visibleSquad(team: Team, day: TrainingDay): Squad | null {
  const squad = squadOf(team, day);
  return squad?.visible ? squad : null;
}

export type SquadResponse = "accepted" | "none" | "declined";

export function responseOf(day: TrainingDay, uid: string): SquadResponse {
  return day.accepted_players[uid] === true ? "accepted" : day.declined_players[uid] === true ? "declined" : "none";
}

/**
 * Orden para convocar: primero quien ha dicho que va, luego quien no ha
 * respondido y al final quien ha dicho que no; los lesionados al final de su
 * grupo; a igualdad, por nombre.
 */
export function rankForSquad<T extends { uid: string; name: string; injured: boolean }>(
  day: TrainingDay,
  players: T[],
): T[] {
  const order: Record<SquadResponse, number> = { accepted: 0, none: 1, declined: 2 };
  return [...players].sort(
    (a, b) =>
      order[responseOf(day, a.uid)] - order[responseOf(day, b.uid)] ||
      Number(a.injured) - Number(b.injured) ||
      a.name.localeCompare(b.name, "es"),
  );
}
