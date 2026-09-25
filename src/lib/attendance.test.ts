import { describe, expect, it } from "vitest";
import {
  attendanceDetailForPlayer,
  attendanceSummaryByPlayer,
  attendedDatesFromTeam,
  calculateAttendanceRate,
  calculateStreak,
  dayOutcome,
  eventDataKey,
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
    eventData: {},
    playerInfo: {},
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

// Asistencia real (paso 2 Kanteo, 2026-09-25) — mismos casos que
// functions/attendance.test.js del repo Android.
describe("dayOutcome / asistencia real", () => {
  const NOW = new Date(2026, 8, 25);
  const d = (fecha: string, extra: Partial<Team["trainingdays"][number]> = {}) => ({
    fecha,
    accepted_players: {},
    declined_players: {},
    ...extra,
  });

  it("sin marca usa la respuesta; con marca manda la marca", () => {
    const t = team({
      trainingdays: [d("01/09/2026", { accepted_players: { ana: true } }), d("08/09/2026")],
      eventData: {
        "2026-09-01": { rsvpNotes: {}, attendance: { ana: "absent" } },
        "2026-09-08": { rsvpNotes: {}, attendance: { ana: "late" } },
      },
    });
    expect(dayOutcome(t, t.trainingdays[0], "ana")).toBe("missed");
    expect(dayOutcome(t, t.trainingdays[1], "ana")).toBe("attended");
    expect(dayOutcome(t, t.trainingdays[0], "marc")).toBe("missed");
    expect(attendedDatesFromTeam(t, "ana")).toEqual(["08/09/2026"]);
  });

  it("lesionado/justificado no cuentan; valores desconocidos se ignoran", () => {
    const t = team({
      trainingdays: [d("01/09/2026"), d("08/09/2026"), d("22/09/2026", { accepted_players: { ana: true } })],
      eventData: {
        "2026-09-01": { rsvpNotes: {}, attendance: { ana: "injured" } },
        "2026-09-08": { rsvpNotes: {}, attendance: { ana: "excused" } },
        "2026-09-22": { rsvpNotes: {}, attendance: { ana: "vino" } },
      },
    });
    const dates = attendedDatesFromTeam(t, "ana");
    expect(dates).toEqual(["22/09/2026"]);
    expect(calculateAttendanceRate(t, dates, NOW, "ana")).toBe(100);
    expect(calculateAttendanceRate(t, dates, NOW)).toBe(33);
    const summary = attendanceSummaryByPlayer(t, {}, NOW).find((s) => s.uid === "ana")!;
    expect(summary).toMatchObject({ attended: 1, total: 1, rate: 100 });
  });

  it("eventDataKey", () => {
    expect(eventDataKey("02/09/2026")).toBe("2026-09-02");
    expect(eventDataKey("2026-09-02")).toBeNull();
  });
});
