import { describe, expect, it } from "vitest";
import { validateNameSurname } from "./profile-validation";

describe("validateNameSurname", () => {
  it("acepta un nombre normal", () => {
    expect(validateNameSurname("Ana García")).toBeNull();
  });

  it("rechaza vacío o solo espacios", () => {
    expect(validateNameSurname("")).not.toBeNull();
    expect(validateNameSurname("   ")).not.toBeNull();
  });

  it("rechaza más de 80 caracteres (coincide con el .validate de la regla)", () => {
    expect(validateNameSurname("a".repeat(80))).toBeNull();
    expect(validateNameSurname("a".repeat(81))).not.toBeNull();
  });
});
