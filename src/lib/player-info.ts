// Ficha del jugador en el equipo (2026-09-25): puestos, dorsal, capitán,
// lesionado — Teams/{t}/playerInfo/{uid}. Lógica pura, sin Firebase.
import { RUGBY_POSITIONS } from "./lineup";
import type { PlayerInfo, Team } from "./types";

export const MAX_POSITIONS = 5;

export const POSITION_GROUPS = [
  { label: "Delanteros", positions: [1, 2, 3, 4, 5, 6, 7, 8] },
  { label: "Tres cuartos", positions: [9, 10, 11, 12, 13, 14, 15] },
] as const;

/** Nombre corto para el campo y chips (las alas y centros se repiten a propósito). */
export const POSITION_SHORT: Record<number, string> = {
  1: "Pilar izq.",
  2: "Talonador",
  3: "Pilar der.",
  4: "2ª línea",
  5: "2ª línea",
  6: "Flanker",
  7: "Flanker",
  8: "Octavo",
  9: "Medio melé",
  10: "Apertura",
  11: "Ala",
  12: "Centro",
  13: "Centro",
  14: "Ala",
  15: "Zaguero",
};

const EMPTY: PlayerInfo = { positions: [] };

export function playerInfoOf(team: Team, uid: string): PlayerInfo {
  return team.playerInfo[uid] ?? EMPTY;
}

/** Quita el puesto si está; si no, lo añade al final (el primero es el principal). Máximo 5. */
export function togglePosition(positions: number[], pos: number): number[] {
  if (positions.includes(pos)) return positions.filter((p) => p !== pos);
  if (positions.length >= MAX_POSITIONS) return positions;
  return [...positions, pos];
}

/** Lo pone el primero (principal) sin perder los demás. */
export function makeMain(positions: number[], pos: number): number[] {
  return positions.includes(pos) ? [pos, ...positions.filter((p) => p !== pos)] : positions;
}

export type PositionFit = "main" | "secondary" | null;

export function positionFit(info: PlayerInfo, pos: number): PositionFit {
  const i = info.positions.indexOf(pos);
  return i === 0 ? "main" : i > 0 ? "secondary" : null;
}

export type Candidate = { uid: string; name: string; info: PlayerInfo };

/**
 * Orden para elegir quién va a un puesto: disponibles antes que lesionados;
 * dentro, primero quien lo tiene como principal, luego como secundario, luego
 * el resto; a igualdad, por nombre.
 */
export function rankCandidates(candidates: Candidate[], pos: number): Candidate[] {
  const fitRank = (c: Candidate) => {
    const fit = positionFit(c.info, pos);
    return fit === "main" ? 0 : fit === "secondary" ? 1 : 2;
  };
  return [...candidates].sort(
    (a, b) =>
      Number(!!a.info.injured) - Number(!!b.info.injured) ||
      fitRank(a) - fitRank(b) ||
      a.name.localeCompare(b.name, "es"),
  );
}

/** "Apertura · +2" / "" — resumen corto para listas. */
export function describePositions(info: PlayerInfo): string {
  if (info.positions.length === 0) return "";
  const main = RUGBY_POSITIONS[info.positions[0]] ?? String(info.positions[0]);
  const extra = info.positions.length - 1;
  return extra > 0 ? `${main} · +${extra}` : main;
}

/** "#10 · Apertura · +2 · Capitán · Lesionado" — línea bajo el nombre en la lista del equipo. */
export function playerInfoSummary(info: PlayerInfo): string {
  return [
    info.number ? `#${info.number}` : "",
    describePositions(info),
    info.captain ? "Capitán" : "",
    info.injured ? "Lesionado" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
