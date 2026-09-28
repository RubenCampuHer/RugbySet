import { describe, expect, it } from "vitest";
import { clubMonthlySeries, clubSummary, statsAreStale, teamRanking, type TeamStatsMap } from "./club-stats";

const s = (rate: number | null, monthly: Record<string, [number, number | null]>, extra = {}) => ({
  players: 10,
  sessions: 8,
  matches: 2,
  rate,
  monthly: Object.fromEntries(Object.entries(monthly).map(([k, [sessions, r]]) => [k, { sessions, matches: 0, rate: r }])),
  lastSessionAt: null,
  updatedAt: new Date(2026, 8, 28, 9).getTime(),
  ...extra,
});

const stats: TeamStatsMap = {
  Sub16: s(80, { "2026-08": [4, 70], "2026-09": [4, 90] }),
  Sub18: s(60, { "2026-09": [4, 50] }),
  Senior: s(null, {}),
};

describe("club en números", () => {
  it("resumen: suma sesiones y jugadores; media de los equipos con dato", () => {
    expect(clubSummary(stats)).toEqual({ teams: 3, players: 30, sessions: 24, matches: 6, rate: 70 });
  });

  it("ranking de más a menos; sin dato al final", () => {
    expect(teamRanking(stats).map((r) => r.team)).toEqual(["Sub16", "Sub18", "Senior"]);
  });

  it("serie mensual del club: media de los equipos de cada mes", () => {
    expect(clubMonthlySeries(stats)).toEqual([
      { key: "2026-08", year: 2026, month: 7, value: 70, sessions: 4 },
      { key: "2026-09", year: 2026, month: 8, value: 70, sessions: 8 },
    ]);
  });

  it("recalcular si falta un equipo o los datos son de otro día", () => {
    const today = new Date(2026, 8, 28, 18);
    expect(statsAreStale(stats, ["Sub16", "Sub18"], today)).toBe(false);
    expect(statsAreStale(stats, ["Sub16", "Nuevo"], today)).toBe(true);
    expect(statsAreStale(stats, ["Sub16"], new Date(2026, 8, 29, 8))).toBe(true);
  });
});
