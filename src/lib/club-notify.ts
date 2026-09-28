// Avisos del club (2026-09-28): a quién le llega un aviso de la dirección.
// Lógica pura: sin Firebase ni React.
import type { Team } from "./types";

export const CLUB_NOTICE_TARGETS = ["all", "players", "coaches"] as const;
export type ClubNoticeTarget = (typeof CLUB_NOTICE_TARGETS)[number];

export const CLUB_NOTICE_TARGET_LABEL: Record<ClubNoticeTarget, string> = {
  all: "Todos (jugadores, entrenadores y delegados)",
  players: "Solo jugadores",
  coaches: "Solo entrenadores",
};

/** Miembros de un equipo según a quién va el aviso. */
export function teamRecipients(team: Team, target: ClubNoticeTarget): string[] {
  const players = Object.keys(team.userplayers);
  const coaches = [team.usercoach, ...Object.keys(team.coaches)].filter((u): u is string => Boolean(u));
  const delegates = Object.keys(team.delegates);
  if (target === "players") return players;
  if (target === "coaches") return coaches;
  return [...players, ...coaches, ...delegates];
}

/**
 * Destinatarios agrupados por equipo (cada aviso lleva su teamName, que las
 * reglas comprueban). Quien está en varios equipos elegidos lo recibe una
 * sola vez, con el primero en el orden dado; quien envía no se avisa a sí mismo.
 */
export function recipientsByTeam(
  teams: Team[],
  selected: Set<string>,
  target: ClubNoticeTarget,
  senderUid: string | null,
): Record<string, string[]> {
  const seen = new Set<string>(senderUid ? [senderUid] : []);
  const out: Record<string, string[]> = {};
  for (const team of teams) {
    const name = team.teamname;
    if (!name || !selected.has(name)) continue;
    const uids = [...new Set(teamRecipients(team, target))].filter((u) => !seen.has(u));
    uids.forEach((u) => seen.add(u));
    if (uids.length) out[name] = uids;
  }
  return out;
}

export function countRecipients(groups: Record<string, string[]>): number {
  return Object.values(groups).reduce((n, uids) => n + uids.length, 0);
}
