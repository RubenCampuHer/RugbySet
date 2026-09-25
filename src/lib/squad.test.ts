import { describe, expect, it } from "vitest";
import { rankForSquad, squadOf, visibleSquad } from "./squad";
import type { Team, TrainingDay } from "./types";

const day = {
  fecha: "24/09/2026",
  accepted_players: { ana: true, zoe: true },
  declined_players: { luis: true },
} as unknown as TrainingDay;

const team = (squad: unknown) =>
  ({
    userplayers: { ana: true, zoe: true, luis: true, bea: true },
    eventData: { "2026-09-24": { attendance: {}, rsvpNotes: {}, squad } },
  }) as unknown as Team;

describe("squad", () => {
  it("squadOf solo cuenta a quien sigue en el roster", () => {
    const s = squadOf(team({ players: { ana: true, fuera: true }, visible: false }), day);
    expect(s).toEqual({ players: ["ana"], visible: false, publishedAt: null });
    expect(squadOf(team(null), day)).toBeNull();
  });

  it("visibleSquad oculta la convocatoria hasta que se hace visible", () => {
    expect(visibleSquad(team({ players: { ana: true }, visible: false }), day)).toBeNull();
    expect(visibleSquad(team({ players: { ana: true }, visible: true }), day)?.players).toEqual(["ana"]);
  });

  it("rankForSquad: van, sin responder, no van; lesionados al final de su grupo", () => {
    const p = (uid: string, injured = false) => ({ uid, name: uid, injured });
    const ranked = rankForSquad(day, [p("luis"), p("bea"), p("zoe", true), p("ana")]);
    expect(ranked.map((x) => x.uid)).toEqual(["ana", "zoe", "bea", "luis"]);
  });
});
