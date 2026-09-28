import { describe, expect, it } from "vitest";
import { countRecipients, recipientsByTeam, teamRecipients } from "./club-notify";
import type { Team } from "./types";

const team = (teamname: string, o: { coach?: string; coaches?: string[]; players?: string[]; delegates?: string[] }): Team =>
  ({
    teamname,
    usercoach: o.coach ?? null,
    coaches: Object.fromEntries((o.coaches ?? []).map((u) => [u, true])),
    userplayers: Object.fromEntries((o.players ?? []).map((u) => [u, true])),
    delegates: Object.fromEntries((o.delegates ?? []).map((u) => [u, true])),
  }) as unknown as Team;

const a = team("A", { coach: "cA", coaches: ["cA2"], players: ["p1", "p2", "shared"], delegates: ["dA"] });
const b = team("B", { coach: "cB", players: ["p3", "shared"] });

describe("teamRecipients", () => {
  it("jugadores, entrenadores (fundador + co) o todos (con delegados)", () => {
    expect(teamRecipients(a, "players")).toEqual(["p1", "p2", "shared"]);
    expect(teamRecipients(a, "coaches")).toEqual(["cA", "cA2"]);
    expect(teamRecipients(a, "all").sort()).toEqual(["cA", "cA2", "dA", "p1", "p2", "shared"]);
  });
});

describe("recipientsByTeam", () => {
  it("solo los equipos elegidos, sin repetir a quien está en dos y sin el remitente", () => {
    const groups = recipientsByTeam([a, b], new Set(["A", "B"]), "players", "p1");
    expect(groups).toEqual({ A: ["p2", "shared"], B: ["p3"] });
    expect(countRecipients(groups)).toBe(3);
  });

  it("un equipo no elegido no recibe nada; un grupo vacío no aparece", () => {
    expect(recipientsByTeam([a, b], new Set(["B"]), "coaches", "cB")).toEqual({});
    expect(recipientsByTeam([a, b], new Set(["B"]), "coaches", null)).toEqual({ B: ["cB"] });
  });
});
