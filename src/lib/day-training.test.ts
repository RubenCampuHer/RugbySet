import { describe, expect, it } from "vitest";
import { dayExercise, dayExerciseHref, dayTraining, dayTrainingHref } from "./day-training";
import { TeamSchema } from "./schemas/team";

const team = TeamSchema.parse({
  teamname: "QA",
  trainingdays: [
    {
      fecha: "02/10/2026",
      horaInicio: "19:00",
      training: {
        name: "Placaje",
        privacy: "Privado",
        sections: [
          {
            sectionName: "Calentamiento",
            tiempoSeccion: 10,
            exercises: [{ order: 0, tiempoExercise: 10, exercise: { name: "Encuadre", descCorta: "copia del día", privacy: "Privado" } }],
          },
        ],
      },
    },
    { fecha: "05/10/2026", horaInicio: "19:00" },
  ],
});

describe("dayTraining", () => {
  it("el entreno guardado en ese día", () => {
    expect(dayTraining(team, "02/10/2026")?.training.name).toBe("Placaje");
  });
  it("día sin entreno, fecha que no está o sin equipo", () => {
    expect(dayTraining(team, "05/10/2026")).toBeNull();
    expect(dayTraining(team, "09/10/2026")).toBeNull();
    expect(dayTraining(null, "02/10/2026")).toBeNull();
    expect(dayTraining(team, null)).toBeNull();
  });
});

describe("dayExercise", () => {
  it("la copia del ejercicio dentro del entreno del día", () => {
    expect(dayExercise(team, "02/10/2026", "Encuadre")?.descCorta).toBe("copia del día");
    expect(dayExercise(team, "02/10/2026", "Otro")).toBeNull();
    expect(dayExercise(team, "05/10/2026", "Encuadre")).toBeNull();
  });
});

describe("enlaces", () => {
  it("llevan equipo y fecha codificados", () => {
    expect(dayTrainingHref("QA Equipo", "02/10/2026")).toBe("/trainings/detail?team=QA+Equipo&fecha=02%2F10%2F2026");
    expect(dayExerciseHref("QA", "02/10/2026", "Encuadre y placaje")).toBe(
      "/exercises/detail?name=Encuadre+y+placaje&team=QA&fecha=02%2F10%2F2026",
    );
  });
});
