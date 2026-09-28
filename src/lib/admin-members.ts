// Añadir a cualquier persona a un equipo (2026-09-28, solo ADMIN). Lógica pura.
import type { PublicProfile, Team } from "./types";

export const MEMBER_ROLES = ["player", "coach", "delegate"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  player: "Jugador",
  coach: "Co-entrenador",
  delegate: "Delegado",
};

/** Papel actual de alguien en el equipo, o null si no está. */
export function roleInTeam(team: Team, uid: string): MemberRole | "founder" | null {
  if (team.usercoach === uid) return "founder";
  if (team.coaches[uid] === true) return "coach";
  if (team.delegates[uid] === true) return "delegate";
  if (team.userplayers[uid] === true) return "player";
  return null;
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Personas que se pueden añadir: fuera del equipo, que coincidan con la
 * búsqueda por nombre o usuario (sin tildes ni mayúsculas), por nombre.
 */
export function addableProfiles(
  profiles: Record<string, PublicProfile>,
  team: Team,
  query: string,
  max = 20,
): { uid: string; profile: PublicProfile }[] {
  const q = norm(query.trim());
  return Object.entries(profiles)
    .filter(([uid]) => roleInTeam(team, uid) === null)
    .filter(([, p]) => !q || norm(p.nameSurname).includes(q) || norm(p.username).includes(q))
    .sort(([, a], [, b]) => (a.nameSurname ?? "").localeCompare(b.nameSurname ?? "", "es", { sensitivity: "base" }))
    .slice(0, max)
    .map(([uid, profile]) => ({ uid, profile }));
}
