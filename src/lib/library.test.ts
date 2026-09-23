import { describe, expect, it } from "vitest";
import { matchesLibraryTab, validateContentName } from "./library";

const ctx = { username: "rudy", favNames: new Set(["Fav"]), myClubId: "c1" };

describe("matchesLibraryTab", () => {
  it("club: solo contenido Club de mi club", () => {
    expect(matchesLibraryTab({ privacy: "Club", clubId: "c1" }, "club", ctx)).toBe(true);
    expect(matchesLibraryTab({ privacy: "Club", clubId: "c2" }, "club", ctx)).toBe(false);
    expect(matchesLibraryTab({ privacy: "Publico", clubId: "c1" }, "club", ctx)).toBe(false);
    expect(
      matchesLibraryTab({ privacy: "Club", clubId: "c1" }, "club", { ...ctx, myClubId: null }),
    ).toBe(false);
  });

  it("own, favs y all", () => {
    expect(matchesLibraryTab({ author: "rudy" }, "own", ctx)).toBe(true);
    expect(matchesLibraryTab({ author: null }, "own", { ...ctx, username: null })).toBe(false);
    expect(matchesLibraryTab({ name: "Fav" }, "favs", ctx)).toBe(true);
    expect(matchesLibraryTab({ name: "Otro" }, "favs", ctx)).toBe(false);
    expect(matchesLibraryTab({}, "all", ctx)).toBe(true);
  });
});

describe("validateContentName", () => {
  it("exige longitud y caracteres válidos", () => {
    expect(validateContentName("Placaje 1")).toBeNull();
    expect(validateContentName(" ab ")).toMatch(/Mínimo/);
    expect(validateContentName("x".repeat(51))).toMatch(/Máximo/);
    expect(validateContentName("a.b.c")).toMatch(/No puede/);
    expect(validateContentName("a/b/c")).toMatch(/No puede/);
    expect(validateContentName("a[b]c")).toMatch(/No puede/);
  });
});
