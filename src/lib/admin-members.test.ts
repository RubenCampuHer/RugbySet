import { describe, expect, it } from "vitest";
import { addableProfiles, roleInTeam } from "./admin-members";
import type { PublicProfile, Team } from "./types";

const team = {
  teamname: "Sub16",
  usercoach: "founder",
  coaches: { co: true },
  delegates: { del: true },
  userplayers: { pl: true, founder: true },
} as unknown as Team;

const p = (nameSurname: string, username: string) => ({ nameSurname, username }) as PublicProfile;
const profiles: Record<string, PublicProfile> = {
  founder: p("Ana Fundadora", "ana"),
  co: p("Carlos Co", "carlos"),
  del: p("Dani Delegado", "dani"),
  pl: p("Pablo Jugador", "pablo"),
  new1: p("Íñigo Pérez", "inigo"),
  new2: p("Beatriz Ruiz", "bea"),
};

describe("roleInTeam", () => {
  it("fundador antes que jugador; co-entrenador, delegado, jugador o nada", () => {
    expect(roleInTeam(team, "founder")).toBe("founder");
    expect(roleInTeam(team, "co")).toBe("coach");
    expect(roleInTeam(team, "del")).toBe("delegate");
    expect(roleInTeam(team, "pl")).toBe("player");
    expect(roleInTeam(team, "new1")).toBeNull();
  });
});

describe("addableProfiles", () => {
  it("solo quien no está en el equipo, por nombre", () => {
    expect(addableProfiles(profiles, team, "").map((x) => x.uid)).toEqual(["new2", "new1"]);
  });

  it("busca por nombre o usuario sin tildes ni mayúsculas", () => {
    expect(addableProfiles(profiles, team, "inigo").map((x) => x.uid)).toEqual(["new1"]);
    expect(addableProfiles(profiles, team, "PÉREZ").map((x) => x.uid)).toEqual(["new1"]);
    expect(addableProfiles(profiles, team, "bea").map((x) => x.uid)).toEqual(["new2"]);
    expect(addableProfiles(profiles, team, "pablo")).toEqual([]);
  });
});
