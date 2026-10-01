import { describe, expect, it } from "vitest";
import { countableMatches, playerMatchStats } from "./match-stats";
import type { Team, TrainingDay } from "./types";

const NOW = new Date(2026, 9, 1, 12); // 01/10/2026

const match = (fecha: string, extra: Partial<TrainingDay> = {}) =>
  ({ fecha, eventType: "MATCH", accepted_players: {}, declined_players: {}, ...extra }) as unknown as TrainingDay;

const lineup = {
  starters: { "1": "Ana", "9": "Luis" },
  bench: { "16": "Bea" },
  players: { "1": { uid: "ana", name: "Ana" }, "9": { uid: "luis", name: "Luis" }, "16": { uid: "bea", name: "Bea" } },
};

const ed = (o: Record<string, unknown> = {}) => ({ attendance: {}, rsvpNotes: {}, ...o });

const team = (trainingdays: TrainingDay[], eventData: Record<string, unknown> = {}, lineups = { L1: lineup }) =>
  ({ trainingdays, eventData, lineups, userplayers: {} }) as unknown as Team;

describe("countableMatches", () => {
  it("solo partidos pasados, sin cancelados ni suspendidos; hoy aún no cuenta", () => {
    const t = team(
      [
        match("20/09/2026"),
        match("21/09/2026", { cancelled: true }),
        match("22/09/2026"),
        match("01/10/2026"),
        { ...match("19/09/2026"), eventType: "TRAINING" } as TrainingDay,
      ],
      { "2026-09-22": ed({ match: { status: "abandoned", videos: {} } }) },
    );
    expect(countableMatches(t, NOW).map((d) => d.fecha)).toEqual(["20/09/2026"]);
  });
});

describe("playerMatchStats", () => {
  it("titular, suplente y convocado sin alineación", () => {
    const t = team(
      [match("20/09/2026", { lineupId: "L1" }), match("27/09/2026")],
      {
        "2026-09-20": ed({ squad: { players: { ana: true, luis: true, bea: true, zoe: true } } }),
        "2026-09-27": ed({ squad: { players: { ana: true, zoe: true } }, attendance: { ana: "present" } }),
      },
    );
    expect(playerMatchStats(t, "ana", NOW)).toEqual({ matches: 2, called: 2, played: 2, started: 1 });
    expect(playerMatchStats(t, "bea", NOW)).toEqual({ matches: 2, called: 1, played: 1, started: 0 });
    // Convocada en los dos, sin alineación ni marca de presente: convocada pero no jugó.
    expect(playerMatchStats(t, "zoe", NOW)).toEqual({ matches: 2, called: 2, played: 0, started: 0 });
    expect(playerMatchStats(t, "nadie", NOW)).toEqual({ matches: 2, called: 0, played: 0, started: 0 });
  });

  it("en la alineación pero marcado falta/lesionado/justificado no cuenta como jugado", () => {
    const t = team([match("20/09/2026", { lineupId: "L1" })], {
      "2026-09-20": ed({ attendance: { ana: "injured", luis: "late" } }),
    });
    expect(playerMatchStats(t, "ana", NOW)).toEqual({ matches: 1, called: 1, played: 0, started: 0 });
    expect(playerMatchStats(t, "luis", NOW)).toEqual({ matches: 1, called: 1, played: 1, started: 1 });
  });

  it("si Android cambió el nombre del puesto, no se fía del uid", () => {
    const edited = { ...lineup, starters: { ...lineup.starters, "1": "Otra" } };
    const t = team([match("20/09/2026", { lineupId: "L1" })], {}, { L1: edited });
    expect(playerMatchStats(t, "ana", NOW).called).toBe(0);
  });

  it("alineación asignada que ya no existe: solo cuenta la convocatoria", () => {
    const t = team([match("20/09/2026", { lineupId: "borrada" })], {
      "2026-09-20": ed({ squad: { players: { ana: true } }, attendance: { ana: "present" } }),
    });
    expect(playerMatchStats(t, "ana", NOW)).toEqual({ matches: 1, called: 1, played: 1, started: 0 });
  });
});
