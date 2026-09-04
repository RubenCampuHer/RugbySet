import { describe, expect, it } from "vitest";
import { nextActiveTeam } from "./teams";

describe("nextActiveTeam", () => {
  it("sin equipos → null", () => {
    expect(nextActiveTeam([])).toBeNull();
  });

  it("elige el primero por orden alfabético (locale es)", () => {
    expect(nextActiveTeam(["Spartans", "Buc B", "Rugby Granollers"])).toBe("Buc B");
  });

  it("excluye el equipo que se abandona", () => {
    expect(nextActiveTeam(["Buc B", "Spartans"], "Buc B")).toBe("Spartans");
  });

  it("si el que se abandona era el único → null", () => {
    expect(nextActiveTeam(["Spartans"], "Spartans")).toBeNull();
  });

  it("no muta la lista de entrada", () => {
    const teams = ["Spartans", "Buc B"];
    nextActiveTeam(teams);
    expect(teams).toEqual(["Spartans", "Buc B"]);
  });
});
