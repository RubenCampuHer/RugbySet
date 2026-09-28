import { describe, expect, it } from "vitest";
import { attendanceByMonth, playerWeek } from "./attendance";
import type { Team, TrainingDay } from "./types";

function day(fecha: string, accepted: string[] = [], extra: Partial<TrainingDay> = {}): TrainingDay {
  return {
    fecha,
    accepted_players: Object.fromEntries(accepted.map((u) => [u, true as const])),
    declined_players: {},
    ...extra,
  };
}

function team(trainingdays: TrainingDay[], eventData: Team["eventData"] = {}): Team {
  return {
    teamname: "Spartans",
    usercoach: "coach",
    teamcode: null,
    teamicon: null,
    userplayers: { ana: true, leo: true },
    pendingplayers: {},
    trainingdays,
    clubId: null,
    category: null,
    lineups: {},
    coaches: {},
    pendingCoaches: {},
    delegates: {},
    eventData,
    playerInfo: {},
  };
}

function marks(attendance: Record<string, string>) {
  return { attendance, maybe: {}, rsvpNotes: {}, rsvpLog: {} } as unknown as Team["eventData"][string];
}

// Miércoles 30/09/2026: la semana va del lunes 28/09 al domingo 04/10.
const now = new Date(2026, 8, 30, 12);

describe("playerWeek", () => {
  it("solo cuenta la semana de lunes a domingo, ordenada", () => {
    const w = playerWeek(
      team([day("04/10/2026"), day("27/09/2026", ["ana"]), day("28/09/2026", ["ana"]), day("05/10/2026")]),
      "ana",
      now,
    );
    expect(w.sessions.map((s) => s.fecha)).toEqual(["28/09/2026", "04/10/2026"]);
  });

  it("pasadas con su resultado; de hoy en adelante, pendientes con la respuesta", () => {
    const w = playerWeek(
      team([
        day("28/09/2026", ["ana"]),
        day("29/09/2026"),
        day("30/09/2026", ["ana"]),
        day("02/10/2026", [], { declined_players: { ana: true } }),
      ]),
      "ana",
      now,
    );
    expect(w.sessions.map((s) => [s.state, s.rsvp])).toEqual([
      ["attended", "accepted"],
      ["missed", "none"],
      ["upcoming", "accepted"],
      ["upcoming", "declined"],
    ]);
    expect(w).toMatchObject({ counted: 2, attended: 1, upcoming: 2 });
  });

  it("la marca al pasar lista manda, también hoy; lesionado no cuenta", () => {
    const w = playerWeek(
      team([day("28/09/2026", ["ana"]), day("29/09/2026"), day("30/09/2026")], {
        "2026-09-28": marks({ ana: "absent" }),
        "2026-09-29": marks({ ana: "injured" }),
        "2026-09-30": marks({ ana: "late" }),
      }),
      "ana",
      now,
    );
    expect(w.sessions.map((s) => s.state)).toEqual(["missed", "excluded", "attended"]);
    expect(w).toMatchObject({ counted: 2, attended: 1, upcoming: 0 });
  });

  it("los cancelados salen como cancelados y no cuentan", () => {
    const w = playerWeek(team([day("28/09/2026", ["ana"], { cancelled: true }), day("01/10/2026")]), "ana", now);
    expect(w.sessions.map((s) => s.state)).toEqual(["cancelled", "upcoming"]);
    expect(w).toMatchObject({ counted: 0, attended: 0, upcoming: 1 });
  });
});

describe("attendanceByMonth sin jugador (media del equipo)", () => {
  it("media de los jugadores por mes, sin % propio", () => {
    const months = attendanceByMonth(
      team([day("10/08/2026", ["ana", "leo"]), day("10/09/2026", ["ana"]), day("20/09/2026", [])]),
      null,
      {},
      now,
    );
    expect(months.map((m) => [m.key, m.teamAverage, m.sessions, m.mine])).toEqual([
      ["2026-08", 100, 1, null],
      ["2026-09", 25, 2, null],
    ]);
  });
});
