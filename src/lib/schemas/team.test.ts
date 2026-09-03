import { describe, expect, it } from "vitest";
import { LineupSchema, TeamSchema, TrainingDaySchema } from "./team";

describe("TeamSchema", () => {
  it("parsea un equipo mínimo con defaults de listas vacías", () => {
    const result = TeamSchema.parse({ teamname: "Spartans", usercoach: "uid1" });
    expect(result.userplayers).toEqual([]);
    expect(result.pendingplayers).toEqual([]);
    expect(result.trainingdays).toEqual([]);
  });

  it("userplayers/pendingplayers como array disperso (RTDB) se normalizan", () => {
    const result = TeamSchema.parse({
      userplayers: { "0": "Jugador Uno", "3": "Jugador Dos" },
      pendingplayers: null,
    });
    expect(result.userplayers).toEqual(["Jugador Uno", "Jugador Dos"]);
    expect(result.pendingplayers).toEqual([]);
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
  it("accepted_players/declined_players por defecto vacíos", () => {
    const result = TrainingDaySchema.parse({ fecha: "01/01/2026" });
    expect(result.accepted_players).toEqual([]);
    expect(result.declined_players).toEqual([]);
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

  it("lineup es opcional (aditivo, sin equivalente en Android todavía)", () => {
    expect(TrainingDaySchema.parse({}).lineup).toBeUndefined();
  });

  it("lineup embebido se parsea con LineupSchema", () => {
    const result = TrainingDaySchema.parse({
      lineup: { published: true, starters: { "1": "Juan Pérez" }, bench: {} },
    });
    expect(result.lineup).toEqual({
      published: true,
      starters: { "1": "Juan Pérez" },
      bench: {},
    });
  });
});

describe("LineupSchema", () => {
  it("defaults: published false, starters/bench vacíos", () => {
    expect(LineupSchema.parse({})).toEqual({ published: false, starters: {}, bench: {} });
  });

  it("acepta nombres del roster y nombres escritos a mano por igual (texto libre)", () => {
    const result = LineupSchema.parse({
      published: true,
      starters: { "1": "Juan Pérez", "9": "Invitado Sin Cuenta" },
      bench: { "16": "Marc López" },
    });
    expect(result.starters["9"]).toBe("Invitado Sin Cuenta");
  });
});
