import { describe, expect, it } from "vitest";
import {
  attendanceDetailForPlayer,
  attendanceSummaryByPlayer,
  attendedDatesFromTeam,
  calculateStreak,
  presetRange,
  sessionsInRange,
} from "./attendance";
import type { Team } from "./types";

// Rosters por uid (2026-09-04): "ana"/"marc" son uids de prueba, no nombres —
// el nombre para mostrar se resuelve aparte (useProfilesByUid), fuera de esta
// lógica pura.
function team(overrides: Partial<Team> = {}): Team {
  return {
    teamname: "Spartans",
    usercoach: "uid1",
    teamcode: null,
    teamicon: null,
    userplayers: { ana: true, marc: true },
    pendingplayers: {},
    trainingdays: [],
    clubId: null,
    category: null,
    lineups: {},
    coaches: {},
    pendingCoaches: {},
    ...overrides,
  };
}

describe("attendedDatesFromTeam", () => {
  const t = team({
    trainingdays: [
      { fecha: "01/01/2026", accepted_players: { ana: true }, declined_players: { marc: true } },
      { fecha: "08/01/2026", accepted_players: { ana: true, marc: true }, declined_players: {} },
      { fecha: "15/01/2026", accepted_players: {}, declined_players: { ana: true } },
      { fecha: null, accepted_players: { ana: true }, declined_players: {} },
    ],
  });

  it("devuelve solo las fechas de ESTE equipo en las que el jugador confirmó", () => {
    expect(attendedDatesFromTeam(t, "ana")).toEqual(["01/01/2026", "08/01/2026"]);
    expect(attendedDatesFromTeam(t, "marc")).toEqual(["08/01/2026"]);
  });

  it("sin equipo o sin uid → vacío (nunca lanza)", () => {
    expect(attendedDatesFromTeam(null, "ana")).toEqual([]);
    expect(attendedDatesFromTeam(t, "")).toEqual([]);
  });

  it("encaja como sustituto de assistedTrainingDays en calculateStreak", () => {
    // Ana faltó al último (15/01) → racha 0; con 'now' antes del 15/01,
    // Ana lleva 2 seguidos.
    expect(calculateStreak(t, attendedDatesFromTeam(t, "ana"), new Date(2026, 0, 20))).toBe(0);
    expect(calculateStreak(t, attendedDatesFromTeam(t, "ana"), new Date(2026, 0, 10))).toBe(2);
  });
});

describe("sessionsInRange", () => {
  it("sin bounds (rango vacío) incluye todo hasta 'now', ordenado cronológicamente", () => {
    const t = team({
      trainingdays: [
        { fecha: "10/01/2026", accepted_players: {}, declined_players: {} },
        { fecha: "01/01/2026", accepted_players: {}, declined_players: {} },
      ],
    });
    const sessions = sessionsInRange(t, {}, new Date(2026, 0, 15));
    expect(sessions.map((s) => s.fecha)).toEqual(["01/01/2026", "10/01/2026"]);
  });

  it("descarta sesiones futuras respecto a 'now' cuando 'to' no se especifica", () => {
    const t = team({
      trainingdays: [
        { fecha: "01/01/2026", accepted_players: {}, declined_players: {} },
        { fecha: "31/12/2026", accepted_players: {}, declined_players: {} },
      ],
    });
    const sessions = sessionsInRange(t, {}, new Date(2026, 0, 15));
    expect(sessions.map((s) => s.fecha)).toEqual(["01/01/2026"]);
  });

  it("from/to son inclusivos en ambos extremos", () => {
    const t = team({
      trainingdays: [
        { fecha: "01/01/2026", accepted_players: {}, declined_players: {} },
        { fecha: "15/01/2026", accepted_players: {}, declined_players: {} },
        { fecha: "31/01/2026", accepted_players: {}, declined_players: {} },
      ],
    });
    const sessions = sessionsInRange(
      t,
      { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) },
      new Date(2026, 5, 1),
    );
    expect(sessions).toHaveLength(3);
  });

  it("ignora sesiones con fecha nula o sin parsear", () => {
    const t = team({
      trainingdays: [
        { fecha: null, accepted_players: {}, declined_players: {} },
        { fecha: "no-es-una-fecha", accepted_players: {}, declined_players: {} },
        { fecha: "01/01/2026", accepted_players: {}, declined_players: {} },
      ],
    });
    const sessions = sessionsInRange(t, {}, new Date(2026, 5, 1));
    expect(sessions).toHaveLength(1);
  });
});

describe("attendanceSummaryByPlayer", () => {
  it("sin sesiones en rango da rate 0 (nunca NaN)", () => {
    const t = team();
    const summary = attendanceSummaryByPlayer(t, {}, new Date(2026, 5, 1));
    expect(summary).toEqual(
      expect.arrayContaining([
        { uid: "ana", attended: 0, total: 0, rate: 0, streak: 0 },
        { uid: "marc", attended: 0, total: 0, rate: 0, streak: 0 },
      ]),
    );
    expect(summary).toHaveLength(2);
  });

  it("calcula attended/total/rate por jugador según accepted_players", () => {
    const t = team({
      trainingdays: [
        { fecha: "01/01/2026", accepted_players: { ana: true }, declined_players: { marc: true } },
        { fecha: "08/01/2026", accepted_players: { ana: true, marc: true }, declined_players: {} },
        { fecha: "15/01/2026", accepted_players: {}, declined_players: {} }, // sin responder para ambos
      ],
    });
    const summary = attendanceSummaryByPlayer(t, {}, new Date(2026, 5, 1));
    const ana = summary.find((s) => s.uid === "ana")!;
    const marc = summary.find((s) => s.uid === "marc")!;
    expect(ana).toEqual({ uid: "ana", attended: 2, total: 3, rate: 67, streak: 0 });
    expect(marc).toEqual({ uid: "marc", attended: 1, total: 3, rate: 33, streak: 0 });
  });

  it("streak cuenta sesiones consecutivas asistidas desde la última del rango", () => {
    const t = team({
      trainingdays: [
        { fecha: "01/01/2026", accepted_players: {}, declined_players: { ana: true } },
        { fecha: "08/01/2026", accepted_players: { ana: true }, declined_players: {} },
        { fecha: "15/01/2026", accepted_players: { ana: true }, declined_players: {} },
      ],
    });
    const summary = attendanceSummaryByPlayer(t, {}, new Date(2026, 5, 1));
    expect(summary.find((s) => s.uid === "ana")!.streak).toBe(2);
  });
});

describe("attendanceDetailForPlayer", () => {
  it("devuelve el estado por sesión del rango, en orden cronológico", () => {
    const t = team({
      trainingdays: [
        { fecha: "08/01/2026", nameTrainingDay: "Martes", accepted_players: { ana: true }, declined_players: {} },
        { fecha: "01/01/2026", nameTrainingDay: "Jueves", accepted_players: {}, declined_players: { ana: true } },
      ],
    });
    const detail = attendanceDetailForPlayer(t, "ana", {}, new Date(2026, 5, 1));
    expect(detail.map((d) => ({ fecha: d.fecha, status: d.status }))).toEqual([
      { fecha: "01/01/2026", status: "declined" },
      { fecha: "08/01/2026", status: "accepted" },
    ]);
  });
});

describe("presetRange", () => {
  it("'week' empieza el lunes de la semana actual", () => {
    // 2026-01-14 es un miércoles.
    const range = presetRange("week", new Date(2026, 0, 14));
    expect(range.from).toEqual(new Date(2026, 0, 12)); // lunes
    expect(range.to).toBeUndefined();
  });

  it("'month' empieza el día 1 del mes actual", () => {
    const range = presetRange("month", new Date(2026, 2, 20));
    expect(range.from).toEqual(new Date(2026, 2, 1));
  });

  it("'lastMonth' acota al mes anterior completo", () => {
    const range = presetRange("lastMonth", new Date(2026, 2, 20));
    expect(range.from).toEqual(new Date(2026, 1, 1));
    expect(range.to).toEqual(new Date(2026, 1, 28)); // febrero 2026 no es bisiesto
  });

  it("'lastMonth' en enero retrocede al diciembre del año anterior", () => {
    const range = presetRange("lastMonth", new Date(2026, 0, 10));
    expect(range.from).toEqual(new Date(2025, 11, 1));
    expect(range.to).toEqual(new Date(2025, 11, 31));
  });

  it("'all' no acota por abajo", () => {
    expect(presetRange("all", new Date(2026, 2, 20))).toEqual({});
  });
});
