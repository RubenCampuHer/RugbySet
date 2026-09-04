import { describe, expect, it } from "vitest";
import { TeamSchema, TrainingDaySchema } from "./team";

describe("TeamSchema", () => {
  it("parsea un equipo mínimo con defaults de mapas/listas vacíos", () => {
    const result = TeamSchema.parse({ teamname: "Spartans", usercoach: "uid1" });
    expect(result.userplayers).toEqual({});
    expect(result.pendingplayers).toEqual({});
    expect(result.trainingdays).toEqual([]);
  });

  it("userplayers/pendingplayers son mapas {uid: true} (rosters por uid, 2026-09-04)", () => {
    const result = TeamSchema.parse({
      userplayers: { uid1: true, uid2: true },
      pendingplayers: null,
    });
    expect(result.userplayers).toEqual({ uid1: true, uid2: true });
    expect(result.pendingplayers).toEqual({});
  });

  it("clubId/category son opcionales (equipo independiente)", () => {
    const result = TeamSchema.parse({ teamname: "Spartans" });
    expect(result.clubId).toBeUndefined();
    expect(result.category).toBeUndefined();
  });

  it("trainingdays embebe TrainingDaySchema completo", () => {
    const result = TeamSchema.parse({
      trainingdays: [
        {
          fecha: "01/01/2026",
          horaInicio: "18:00",
          horaFin: "19:30",
          eventType: "MATCH",
          location: "Campo municipal",
        },
      ],
    });
    expect(result.trainingdays[0].eventType).toBe("MATCH");
    expect(result.trainingdays[0].location).toBe("Campo municipal");
  });
});

describe("TrainingDaySchema", () => {
  it("accepted_players/declined_players son mapas {uid: true}, por defecto vacíos", () => {
    const result = TrainingDaySchema.parse({ fecha: "01/01/2026" });
    expect(result.accepted_players).toEqual({});
    expect(result.declined_players).toEqual({});
  });

  it("accepted_players/declined_players se parsean como mapa uid->true", () => {
    const result = TrainingDaySchema.parse({
      accepted_players: { uid1: true },
      declined_players: { uid2: true },
    });
    expect(result.accepted_players).toEqual({ uid1: true });
    expect(result.declined_players).toEqual({ uid2: true });
  });

  it("eventType nullish acepta TRAINING, MATCH o ausente — no un valor arbitrario", () => {
    expect(TrainingDaySchema.parse({ eventType: "TRAINING" }).eventType).toBe("TRAINING");
    expect(TrainingDaySchema.parse({ eventType: "MATCH" }).eventType).toBe("MATCH");
    expect(TrainingDaySchema.parse({}).eventType).toBeUndefined();
    expect(TrainingDaySchema.safeParse({ eventType: "FRIENDLY" }).success).toBe(false);
  });

  it("training embebido es opcional (aditivo 2026-07-13)", () => {
    expect(TrainingDaySchema.parse({}).training).toBeUndefined();
  });

  it("lineupId es opcional — referencia a Teams/{team}/lineups/{id}, ausente = ninguna publicada (rediseño 2026-09-03)", () => {
    expect(TrainingDaySchema.parse({}).lineupId).toBeUndefined();
    expect(TrainingDaySchema.parse({ lineupId: "-Nabc123" }).lineupId).toBe("-Nabc123");
  });
});

describe("TeamSchema.lineups", () => {
  it("por defecto vacío", () => {
    expect(TeamSchema.parse({ teamname: "Spartans" }).lineups).toEqual({});
  });

  it("se parsea como objeto por lineupId, cada uno con LineupDocSchema completo", () => {
    const result = TeamSchema.parse({
      lineups: {
        "-Nabc123": {
          lineupId: "-Nabc123",
          name: "Plan A",
          starters: { "1": "Juan Pérez" },
          bench: {},
        },
      },
    });
    expect(result.lineups["-Nabc123"].name).toBe("Plan A");
    expect(result.lineups["-Nabc123"].starters["1"]).toBe("Juan Pérez");
  });
});

describe("TeamSchema.coaches / pendingCoaches (varios entrenadores, rediseño 2026-09-03)", () => {
  it("por defecto vacíos", () => {
    const result = TeamSchema.parse({ teamname: "Spartans" });
    expect(result.coaches).toEqual({});
    expect(result.pendingCoaches).toEqual({});
  });

  it("se parsean como mapa uid->true", () => {
    const result = TeamSchema.parse({
      coaches: { uid1: true },
      pendingCoaches: { uid2: true },
    });
    expect(result.coaches).toEqual({ uid1: true });
    expect(result.pendingCoaches).toEqual({ uid2: true });
  });
});
