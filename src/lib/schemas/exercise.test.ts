import { describe, expect, it } from "vitest";
import { ExerciseSchema } from "./exercise";

describe("ExerciseSchema", () => {
  it("parsea un ejercicio público aprobado", () => {
    const result = ExerciseSchema.parse({
      name: "Pase",
      privacy: "Publico",
      author: "rudyx28",
      approvalStatus: "APPROVED",
      etiquetas: ["pases", "calentamiento"],
      created_at: 1_753_000_000_000,
    });
    expect(result.approvalStatus).toBe("APPROVED");
  });

  it("approvalStatus null es válido (contenido legacy sin sistema de aprobación)", () => {
    expect(ExerciseSchema.parse({ approvalStatus: null }).approvalStatus).toBeNull();
  });

  it("un approvalStatus fuera del enum falla el parse (sin catch, a diferencia de role)", () => {
    expect(ExerciseSchema.safeParse({ approvalStatus: "APROBADO" }).success).toBe(false);
  });

  it("privacy Club requiere clubId en la práctica, pero el schema no lo obliga", () => {
    // clubId es nullish independientemente de privacy — la relación la
    // impone permissions.ts (canViewExercise), no el schema.
    const result = ExerciseSchema.parse({ privacy: "Club", clubId: "club1" });
    expect(result.clubId).toBe("club1");
  });

  it("etiquetas por defecto vacío, boardData opcional (solo lo genera la web)", () => {
    const result = ExerciseSchema.parse({});
    expect(result.etiquetas).toEqual([]);
    expect(result.boardData).toBeUndefined();
  });
});
