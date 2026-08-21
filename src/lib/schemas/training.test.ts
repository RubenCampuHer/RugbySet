import { describe, expect, it } from "vitest";
import { ExerciseTrainingSchema, SectionSchema, TrainingSchema } from "./training";

describe("ExerciseTrainingSchema", () => {
  it("embebe el Exercise completo (copia, no referencia)", () => {
    const result = ExerciseTrainingSchema.parse({
      exercise: { name: "Pase", privacy: "Publico" },
      tiempoExercise: 10,
      order: 0,
    });
    expect(result.exercise?.name).toBe("Pase");
  });

  it("tiempoExercise/order caen a 0 si vienen corruptos, en vez de reventar", () => {
    const result = ExerciseTrainingSchema.parse({ tiempoExercise: "diez", order: null });
    expect(result.tiempoExercise).toBe(0);
    expect(result.order).toBe(0);
  });
});

describe("SectionSchema", () => {
  it("sectionName cae a '' si viene corrupto", () => {
    expect(SectionSchema.parse({ sectionName: 123 }).sectionName).toBe("");
  });

  it("exercises por defecto vacío", () => {
    expect(SectionSchema.parse({}).exercises).toEqual([]);
  });
});

describe("TrainingSchema", () => {
  it("parsea un entreno completo con secciones anidadas", () => {
    const result = TrainingSchema.parse({
      name: "Entreno físico",
      privacy: "Club",
      clubId: "club1",
      author: "rudyx28",
      sections: [
        {
          sectionName: "Calentamiento",
          tiempoSeccion: 15,
          exercises: [{ exercise: { name: "Pase" }, tiempoExercise: 5, order: 0 }],
        },
      ],
    });
    expect(result.sections[0].exercises[0].exercise?.name).toBe("Pase");
  });

  it("un entreno sin secciones parsea con defaults", () => {
    const result = TrainingSchema.parse({ name: "Vacío" });
    expect(result.sections).toEqual([]);
    expect(result.etiquetas).toEqual([]);
  });
});
