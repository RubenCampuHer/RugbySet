// Público de un contenido del club (2026-09-28): quién lo ve. Mismo criterio
// que las reglas de ClubLessons (database.rules.json del repo Android) para
// lecciones y carpetas; en ejercicios/entrenos "Club" se aplica solo en el
// cliente, igual que la privacidad de siempre. "Cuerpo técnico" = entrenadores
// (fundador y co-entrenadores) y dirección; los delegados NO cuentan.
import { z } from "zod";

export const AUDIENCE_KINDS = ["club", "staff", "teams", "teamsStaff"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

export const AudienceSchema = z.object({
  kind: z.enum(AUDIENCE_KINDS).catch("club"),
  teams: z.record(z.string(), z.literal(true)).nullish().catch(null),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const CLUB_AUDIENCE: Audience = { kind: "club", teams: null };

export const AUDIENCE_LABEL: Record<AudienceKind, string> = {
  club: "Todo el club",
  staff: "Cuerpo técnico del club",
  teams: "Equipos concretos",
  teamsStaff: "Cuerpo técnico de equipos concretos",
};

export const AUDIENCE_HINT: Record<AudienceKind, string> = {
  club: "Jugadores, entrenadores y dirección de todos los equipos.",
  staff: "Entrenadores de todos los equipos y la dirección. No lo ven jugadores ni delegados.",
  teams: "Todos los miembros de los equipos que elijas, y la dirección.",
  teamsStaff: "Solo los entrenadores de los equipos que elijas, y la dirección.",
};

export const needsTeams = (kind: AudienceKind) => kind === "teams" || kind === "teamsStaff";

/** Quien mira: dirección del club, entrenador (no delegado) de su equipo activo del club, y ese equipo. */
export type AudienceViewer = {
  isDirector: boolean;
  /** Equipo activo, si es de este club. */
  activeTeam: string | null;
  /** Entrenador (fundador o co-entrenador) de ese equipo activo. */
  isCoachOfActive: boolean;
};

export function teamsOf(audience: Audience | null | undefined): string[] {
  return Object.keys(audience?.teams ?? {});
}

/** ¿Lo ve? Sin público = todo el club (lo de antes). */
export function canSeeAudience(audience: Audience | null | undefined, viewer: AudienceViewer): boolean {
  if (viewer.isDirector) return true;
  if (!viewer.activeTeam) return false;
  const a = audience ?? CLUB_AUDIENCE;
  const inTeams = a.teams?.[viewer.activeTeam] === true;
  switch (a.kind) {
    case "club":
      return true;
    case "staff":
      return viewer.isCoachOfActive;
    case "teams":
      return inTeams;
    case "teamsStaff":
      return inTeams && viewer.isCoachOfActive;
  }
}

/** Texto corto para una etiqueta: null si es todo el club (no hace falta marcarlo). */
export function audienceBadge(audience: Audience | null | undefined): string | null {
  const a = audience ?? CLUB_AUDIENCE;
  const teams = teamsOf(a);
  const list = teams.length <= 2 ? teams.join(", ") : `${teams.length} equipos`;
  switch (a.kind) {
    case "club":
      return null;
    case "staff":
      return "Entrenadores";
    case "teams":
      return list || "Sin equipos";
    case "teamsStaff":
      return `${list || "Sin equipos"} · entrenadores`;
  }
}

/** Normaliza para guardar: sin equipos si el tipo no los usa; un tipo con equipos pero sin ninguno no vale. */
export function normalizeAudience(audience: Audience): Audience | null {
  if (!needsTeams(audience.kind)) return { kind: audience.kind, teams: null };
  const teams = teamsOf(audience);
  if (teams.length === 0) return null;
  return { kind: audience.kind, teams: Object.fromEntries(teams.map((t) => [t, true as const])) };
}

export function sameAudience(a: Audience | null | undefined, b: Audience | null | undefined): boolean {
  const x = a ?? CLUB_AUDIENCE;
  const y = b ?? CLUB_AUDIENCE;
  return x.kind === y.kind && teamsOf(x).sort().join("|") === teamsOf(y).sort().join("|");
}
