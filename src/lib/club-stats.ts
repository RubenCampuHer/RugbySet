// "El club en números" (2026-09-28): resúmenes sobre ClubStats. Lógica pura.
import type { ClubTeamStats } from "./schemas/club";

export type TeamStatsMap = Record<string, ClubTeamStats>;

/** Serie mensual: un punto por mes (yyyy-MM) con la media de los equipos que tienen dato. */
export type MonthlyPoint = { key: string; year: number; month: number; value: number; sessions: number };

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function clubSummary(stats: TeamStatsMap) {
  const teams = Object.values(stats);
  return {
    teams: teams.length,
    players: teams.reduce((n, t) => n + t.players, 0),
    sessions: teams.reduce((n, t) => n + t.sessions, 0),
    matches: teams.reduce((n, t) => n + t.matches, 0),
    /** Media de los equipos con dato (cada equipo pesa lo mismo). */
    rate: mean(teams.map((t) => t.rate).filter((r): r is number => r != null)),
  };
}

/** Equipos de más a menos asistencia; los que no tienen dato, al final por nombre. */
export function teamRanking(stats: TeamStatsMap): { team: string; stats: ClubTeamStats }[] {
  return Object.entries(stats)
    .map(([team, s]) => ({ team, stats: s }))
    .sort(
      (a, b) =>
        (b.stats.rate ?? -1) - (a.stats.rate ?? -1) || a.team.localeCompare(b.team, "es", { sensitivity: "base" }),
    );
}

export function clubMonthlySeries(stats: TeamStatsMap, max = 12): MonthlyPoint[] {
  const byMonth = new Map<string, { rates: number[]; sessions: number }>();
  for (const s of Object.values(stats)) {
    for (const [key, m] of Object.entries(s.monthly)) {
      const e = byMonth.get(key) ?? { rates: [], sessions: 0 };
      if (m.rate != null) e.rates.push(m.rate);
      e.sessions += m.sessions;
      byMonth.set(key, e);
    }
  }
  return [...byMonth.entries()]
    .filter(([, e]) => e.rates.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-max)
    .map(([key, e]) => {
      const [y, m] = key.split("-").map(Number);
      return { key, year: y, month: m - 1, value: mean(e.rates)!, sessions: e.sessions };
    });
}

/** ¿Hay que recalcular? Sin datos de algún equipo del club, o calculados otro día (las sesiones cuentan desde el día siguiente). */
export function statsAreStale(stats: TeamStatsMap, clubTeams: string[], now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return clubTeams.some((t) => {
    const s = stats[t];
    return !s || s.updatedAt == null || s.updatedAt < today;
  });
}
