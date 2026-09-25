import { describe, expect, it } from "vitest";
import {
  attendanceByMonth,
  attendanceSummaryByPlayer,
  calculateAttendanceRate,
  countableDays,
  teamComparison,
} from "./attendance";
import type { Team, TrainingDay } from "./types";

function day(fecha: string, accepted: string[], extra: Partial<TrainingDay> = {}): TrainingDay {
  return {
    fecha,
    accepted_players: Object.fromEntries(accepted.map((u) => [u, true as const])),
    declined_players: {},
    ...extra,
  };
}

function team(trainingdays: TrainingDay[], players = ["ana", "marc", "leo"]): Team {
  return {
    teamname: "Spartans",
    usercoach: "coach",
    teamcode: null,
    teamicon: null,
    userplayers: Object.fromEntries(players.map((p) => [p, true as const])),
    pendingplayers: {},
    trainingdays,
    clubId: null,
    category: null,
    lineups: {},
    coaches: {},
    pendingCoaches: {},
    eventData: {},
  };
}

const now = new Date(2026, 9, 31); // 31/10/2026

describe("eventos cancelados", () => {
  const t = team([
    day("01/10/2026", ["ana"]),
    day("08/10/2026", [], { cancelled: true }),
    day("15/10/2026", ["ana"]),
  ]);

  it("no cuentan para asistencia", () => {
    expect(countableDays(t)).toHaveLength(2);
    expect(calculateAttendanceRate(t, ["01/10/2026", "15/10/2026"], now)).toBe(100);
    const ana = attendanceSummaryByPlayer(t, {}, now).find((s) => s.uid === "ana")!;
    expect(ana).toMatchObject({ attended: 2, total: 2, rate: 100, streak: 2 });
  });
});

describe("teamComparison", () => {
  const t = team([
    day("01/10/2026", ["ana", "marc"]),
    day("08/10/2026", ["ana"]),
    day("15/10/2026", ["ana", "leo"]),
    day("22/10/2026", ["marc"]),
  ]);

  it("da mi %, la media, mi posición y el tamaño", () => {
    // ana 75, marc 50, leo 25 → media 50
    expect(teamComparison(t, "ana", {}, now)).toEqual({
      mine: 75,
      teamAverage: 50,
      rank: 1,
      size: 3,
      sessions: 4,
    });
    expect(teamComparison(t, "leo", {}, now)?.rank).toBe(3);
  });

  it("empates comparten puesto", () => {
    const t2 = team([day("01/10/2026", ["ana", "marc"])]);
    expect(teamComparison(t2, "marc", {}, now)?.rank).toBe(1);
    expect(teamComparison(t2, "leo", {}, now)?.rank).toBe(3);
  });

  it("null si el uid no es jugador del equipo", () => {
    expect(teamComparison(t, "coach", {}, now)).toBeNull();
  });
});

describe("attendanceByMonth", () => {
  it("agrupa por mes con mi % y la media", () => {
    const t = team(
      [day("20/09/2026", ["ana"]), day("01/10/2026", ["ana", "marc"]), day("08/10/2026", [])],
      ["ana", "marc"],
    );
    expect(attendanceByMonth(t, "ana", {}, now)).toEqual([
      { key: "2026-09", year: 2026, month: 8, sessions: 1, mine: 100, teamAverage: 50 },
      { key: "2026-10", year: 2026, month: 9, sessions: 2, mine: 50, teamAverage: 50 },
    ]);
  });

  it("ignora sesiones futuras", () => {
    const t = team([day("01/12/2026", ["ana"])]);
    expect(attendanceByMonth(t, "ana", {}, now)).toEqual([]);
  });
});
