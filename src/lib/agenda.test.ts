import { describe, expect, it } from "vitest";
import { agendaGroups, limitGroups, noAnswerUids, playerPending, relativeDayLabel, staffHome } from "./agenda";
import type { Team, TrainingDay } from "./types";

function day(fecha: string, extra: Partial<TrainingDay> = {}): TrainingDay {
  return { fecha, accepted_players: {}, declined_players: {}, ...extra };
}

function team(trainingdays: TrainingDay[]): Team {
  return {
    teamname: "Spartans",
    usercoach: "coach",
    teamcode: null,
    teamicon: null,
    userplayers: { ana: true, marc: true },
    pendingplayers: {},
    trainingdays,
    clubId: null,
    category: null,
    lineups: {},
    coaches: {},
    pendingCoaches: {},
  };
}

// Miércoles 23/09/2026
const now = new Date(2026, 8, 23, 10, 0);

describe("relativeDayLabel", () => {
  it("usa etiquetas relativas hasta una semana", () => {
    expect(relativeDayLabel("23/09/2026", now)).toBe("hoy");
    expect(relativeDayLabel("24/09/2026", now)).toBe("mañana");
    expect(relativeDayLabel("22/09/2026", now)).toBe("ayer");
    expect(relativeDayLabel("27/09/2026", now)).toBe("dentro de 4 días");
    expect(relativeDayLabel("20/09/2026", now)).toBe("hace 3 días");
  });

  it("más lejos, fecha corta; basura, cadena vacía", () => {
    expect(relativeDayLabel("15/10/2026", now)).toMatch(/15/);
    expect(relativeDayLabel("xx", now)).toBe("");
  });
});

describe("agendaGroups", () => {
  const t = team([
    day("30/09/2026"),
    day("23/09/2026"),
    day("27/09/2026"),
    day("12/10/2026"),
    day("21/09/2026"),
    day("15/09/2026"),
  ]);

  it("próximos por semanas, en orden", () => {
    const g = agendaGroups(t, "upcoming", now);
    expect(g.map((x) => x.label)).toEqual([
      "Esta semana",
      "La semana que viene",
      "Semana del 12 de octubre",
    ]);
    expect(g[0].entries.map((e) => e.day.fecha)).toEqual(["23/09/2026", "27/09/2026"]);
  });

  it("limitGroups recorta sin perder cabeceras", () => {
    const g = limitGroups(agendaGroups(t, "upcoming", now), 3);
    expect(g.map((x) => x.entries.length)).toEqual([2, 1]);
  });

  it("pasados en orden inverso", () => {
    const g = agendaGroups(t, "past", now);
    expect(g.map((x) => x.label)).toEqual(["Esta semana", "La semana pasada"]);
    expect(g[0].entries[0].day.fecha).toBe("21/09/2026");
  });
});

describe("staffHome", () => {
  const t = team([
    day("24/09/2026", { accepted_players: { ana: true } }), // próximo, 1 sin responder
    day("26/09/2026", { eventType: "MATCH" }), // partido, 2 sin responder
    day("20/09/2026", { declined_players: { marc: true } }), // pasado, 1 sin marcar
    day("21/09/2026", { cancelled: true }), // cancelado: nada
    day("01/08/2026"), // demasiado antiguo
    day("10/10/2026", { eventType: "MATCH" }), // lejano
  ]);

  it("lista avisos pendientes primero y luego pasar lista", () => {
    const { tasks, nextMatch } = staffHome(t, now);
    expect(tasks.map((x) => [x.kind, x.fecha, x.count])).toEqual([
      ["unanswered", "24/09/2026", 1],
      ["unanswered", "26/09/2026", 2],
      ["rollcall", "20/09/2026", 1],
    ]);
    expect(nextMatch?.day.fecha).toBe("26/09/2026");
  });

  it("noAnswerUids", () => {
    expect(noAnswerUids(t, t.trainingdays[0])).toEqual(["marc"]);
  });
});

describe("playerPending", () => {
  it("solo próximos 7 días, sin responder y no cancelados", () => {
    const t = team([
      day("24/09/2026"),
      day("25/09/2026", { accepted_players: { ana: true } }),
      day("26/09/2026", { cancelled: true }),
      day("05/10/2026"),
      day("22/09/2026"),
    ]);
    expect(playerPending(t, "ana", now).map((e) => e.day.fecha)).toEqual(["24/09/2026"]);
  });
});
