import { describe, expect, it } from "vitest";
import { audienceBadge, canSeeAudience, normalizeAudience, sameAudience, type Audience, type AudienceViewer } from "./audience";
import { inheritedAudienceUpdates, resolveAudience, type Folders, type Lessons } from "./lessons";

const viewer = (v: Partial<AudienceViewer>): AudienceViewer => ({ isDirector: false, activeTeam: "Sub16", isCoachOfActive: false, ...v });
const aud = (kind: Audience["kind"], teams?: string[]): Audience => ({
  kind,
  teams: teams ? Object.fromEntries(teams.map((t) => [t, true as const])) : null,
});

describe("canSeeAudience", () => {
  const player16 = viewer({});
  const coach16 = viewer({ isCoachOfActive: true });
  const player18 = viewer({ activeTeam: "Sub18" });
  const coach18 = viewer({ activeTeam: "Sub18", isCoachOfActive: true });
  const director = viewer({ isDirector: true, activeTeam: null });
  const noTeam = viewer({ activeTeam: null });

  it("todo el club (y sin público = todo el club)", () => {
    for (const a of [aud("club"), null, undefined]) {
      expect([player16, coach18, director].every((v) => canSeeAudience(a, v))).toBe(true);
      expect(canSeeAudience(a, noTeam)).toBe(false);
    }
  });

  it("cuerpo técnico del club: entrenadores y dirección, no jugadores", () => {
    const a = aud("staff");
    expect([coach16, coach18, director].map((v) => canSeeAudience(a, v))).toEqual([true, true, true]);
    expect([player16, player18].map((v) => canSeeAudience(a, v))).toEqual([false, false]);
  });

  it("equipos concretos: todos sus miembros", () => {
    const a = aud("teams", ["Sub16"]);
    expect([player16, coach16, director].every((v) => canSeeAudience(a, v))).toBe(true);
    expect([player18, coach18].some((v) => canSeeAudience(a, v))).toBe(false);
  });

  it("cuerpo técnico de equipos concretos", () => {
    const a = aud("teamsStaff", ["Sub16", "Sub18"]);
    expect([coach16, coach18, director].every((v) => canSeeAudience(a, v))).toBe(true);
    expect([player16, player18].some((v) => canSeeAudience(a, v))).toBe(false);
  });
});

describe("etiquetas y normalización", () => {
  it("badge corto", () => {
    expect(audienceBadge(aud("club"))).toBeNull();
    expect(audienceBadge(aud("staff"))).toBe("Entrenadores");
    expect(audienceBadge(aud("teams", ["Sub16"]))).toBe("Sub16");
    expect(audienceBadge(aud("teamsStaff", ["A", "B", "C"]))).toBe("3 equipos · entrenadores");
  });

  it("quita equipos si no aplican y rechaza equipos vacíos", () => {
    expect(normalizeAudience(aud("staff", ["X"]))).toEqual({ kind: "staff", teams: null });
    expect(normalizeAudience(aud("teams", []))).toBeNull();
    expect(sameAudience(aud("teams", ["A", "B"]), aud("teams", ["B", "A"]))).toBe(true);
    expect(sameAudience(null, aud("club"))).toBe(true);
  });
});

describe("herencia de carpetas", () => {
  const f = (name: string, parentId: string | null, audience: Audience, inherited: boolean) => ({
    name,
    parentId,
    createdBy: "u",
    createdAt: 1,
    audience,
    audienceInherited: inherited,
  });
  const folders: Folders = {
    root: f("Metodología", null, aud("club"), true),
    sub: f("Placaje", "root", aud("club"), true),
    own: f("Solo Sub16", "root", aud("teams", ["Sub16"]), false),
    deep: f("Dentro de propia", "own", aud("teams", ["Sub16"]), true),
  };
  const lesson = (folderId: string, inherited: boolean) => ({
    title: "L",
    folderId,
    createdBy: "u",
    createdAt: 1,
    updatedAt: 1,
    blocks: {},
    audience: aud("club"),
    audienceInherited: inherited,
  });
  const lessons: Lessons = { l1: lesson("sub", true), l2: lesson("sub", false), l3: lesson("deep", true) };
  const pending: Lessons = { p1: lesson("root", true) };

  it("sin público propio hereda el de la carpeta; en la raíz, todo el club", () => {
    expect(resolveAudience(folders, "own", null)).toEqual({ audience: aud("teams", ["Sub16"]), audienceInherited: true });
    expect(resolveAudience(folders, null, null).audience.kind).toBe("club");
    expect(resolveAudience(folders, "own", aud("staff"))).toEqual({ audience: aud("staff"), audienceInherited: false });
  });

  it("cambiar una carpeta reescribe lo que hereda y se para en lo que tiene público propio", () => {
    const u = inheritedAudienceUpdates(folders, lessons, pending, "root", aud("staff"));
    expect(Object.keys(u).sort()).toEqual(["folders/sub/audience", "lessons/l1/audience", "pending/p1/audience"]);
  });
});
