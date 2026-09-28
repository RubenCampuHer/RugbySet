import { describe, expect, it } from "vitest";
import { clubAgendaGroups } from "./agenda";
import type { Team, TrainingDay } from "./types";

const day = (fecha: string, horaInicio = "19:00", extra: Partial<TrainingDay> = {}): TrainingDay =>
  ({ fecha, horaInicio, accepted_players: {}, declined_players: {}, ...extra }) as TrainingDay;
const team = (teamname: string, days: TrainingDay[]) => ({ teamname, trainingdays: days }) as unknown as Team;

// Lunes 28/09/2026.
const now = new Date(2026, 8, 28, 10);

describe("clubAgendaGroups", () => {
  const a = team("Sub16", [day("28/09/2026", "18:00"), day("02/10/2026"), day("21/09/2026")]);
  const b = team("Sub18", [day("28/09/2026", "18:00", { clubEventId: "ev1" }), day("06/10/2026")]);

  it("junta los equipos, desde hoy, por semana, día, hora y equipo", () => {
    const g = clubAgendaGroups([b, a], "upcoming", now);
    expect(g.map((x) => x.label)).toEqual(["Esta semana", "La semana que viene"]);
    expect(g[0].entries.map((e) => `${e.day.fecha} ${e.team.teamname}`)).toEqual([
      "28/09/2026 Sub16",
      "28/09/2026 Sub18",
      "02/10/2026 Sub16",
    ]);
    expect(g[1].entries.map((e) => e.team.teamname)).toEqual(["Sub18"]);
  });

  it("pasados en orden descendente", () => {
    const g = clubAgendaGroups([a, b], "past", now);
    expect(g.flatMap((x) => x.entries.map((e) => e.day.fecha))).toEqual(["21/09/2026"]);
    expect(g[0].label).toBe("La semana pasada");
  });
});
