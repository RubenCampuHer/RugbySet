import { describe, expect, it } from "vitest";
import {
  cleanExtrasDraft,
  extrasFiles,
  isEmptyExtras,
  levelCount,
  sortedLevels,
  toRtdb,
  unusedFiles,
  validateExerciseVideo,
} from "./exercise-extras";
import { ExerciseExtrasSchema } from "./schemas/exercise-extras";

const file = (path: string) => ({ source: "file" as const, url: `https://s/${path}`, path });
const link = (url: string) => ({ source: "link" as const, url });

describe("ExerciseExtrasSchema", () => {
  it("descarta niveles rotos sin tirar el resto", () => {
    const x = ExerciseExtrasSchema.parse({
      updatedAt: 1,
      updatedBy: "u",
      levels: { a: { name: "2v1", order: 0 }, b: { order: "x" } },
    });
    expect(x.levels.b).toBeNull();
    expect(levelCount(x)).toBe(1);
  });
  it("acepta el nodo vacío", () => {
    expect(levelCount(ExerciseExtrasSchema.parse({}))).toBe(0);
  });
});

describe("sortedLevels", () => {
  it("ordena por order y luego por id", () => {
    const x = ExerciseExtrasSchema.parse({
      levels: { c: { name: "3v2", order: 2 }, a: { name: "2v1", order: 0 }, b: { name: "2v2", order: 0 } },
    });
    expect(sortedLevels(x).map((e) => e.level.name)).toEqual(["2v1", "2v2", "3v2"]);
  });
});

describe("ficheros", () => {
  const x = ExerciseExtrasSchema.parse({
    video: file("exercise_videos/u/base.mp4"),
    levels: { a: { name: "2v1", order: 0, video: file("exercise_videos/u/l1.mp4") }, b: { name: "2v2", order: 1, video: link("https://youtu.be/x") } },
  });
  it("extrasFiles solo cuenta los subidos", () => {
    expect(extrasFiles(x)).toEqual(["exercise_videos/u/base.mp4", "exercise_videos/u/l1.mp4"]);
  });
  it("unusedFiles respeta lo que se guarda y las copias", () => {
    const kept = ExerciseExtrasSchema.parse({ video: file("exercise_videos/u/base.mp4") });
    const copy = ExerciseExtrasSchema.parse({ levels: { a: { name: "x", order: 0, video: file("exercise_videos/u/l1.mp4") } } });
    expect(unusedFiles(extrasFiles(x), kept, {})).toEqual(["exercise_videos/u/l1.mp4"]);
    expect(unusedFiles(extrasFiles(x), kept, { Copia: copy })).toEqual([]);
    expect(unusedFiles(extrasFiles(x), null, {})).toEqual(extrasFiles(x));
  });
});

describe("validateExerciseVideo", () => {
  it("solo vídeo por debajo de 200 MB", () => {
    expect(validateExerciseVideo({ type: "video/mp4", size: 1000 })).toBeNull();
    expect(validateExerciseVideo({ type: "image/png", size: 1000 })).toMatch(/vídeo/);
    expect(validateExerciseVideo({ type: "video/mp4", size: 200 * 1024 * 1024 })).toMatch(/200 MB/);
  });
});

describe("cleanExtrasDraft", () => {
  const lv = (id: string, name: string, extra: object = {}) => ({ id, level: { name, order: 9, ...extra } });
  it("renumera, recorta y quita niveles vacíos", () => {
    const r = cleanExtrasDraft({ video: null, levels: [lv("a", " 2v1 "), lv("b", ""), lv("c", "2v2", { desc: "  más  " })] });
    expect(r).toEqual({
      ok: true,
      video: null,
      levels: { a: { name: "2v1", desc: null, order: 0, video: null }, c: { name: "2v2", desc: "más", order: 1, video: null } },
    });
  });
  it("un nivel con texto pero sin nombre es un error", () => {
    const r = cleanExtrasDraft({ video: null, levels: [lv("a", "", { desc: "algo" })] });
    expect(r.ok).toBe(false);
  });
  it("enlaces: vacío se quita, javascript: es error", () => {
    expect(cleanExtrasDraft({ video: link("  "), levels: [] })).toMatchObject({ ok: true, video: null });
    expect(cleanExtrasDraft({ video: link("javascript:alert(1)"), levels: [] }).ok).toBe(false);
    expect(cleanExtrasDraft({ video: null, levels: [lv("a", "2v1", { video: link("ftp://x") })] }).ok).toBe(false);
  });
});

describe("toRtdb", () => {
  it("no escribe null (las reglas no los esperan)", () => {
    const out = toRtdb(
      { source: "link", url: "https://y", path: null, title: null },
      { a: { name: "2v1", desc: null, order: 0, video: null } },
      "u",
      5,
    );
    expect(out).toEqual({ updatedAt: 5, updatedBy: "u", video: { source: "link", url: "https://y" }, levels: { a: { name: "2v1", order: 0 } } });
  });
  it("isEmptyExtras", () => {
    expect(isEmptyExtras(null, {})).toBe(true);
    expect(isEmptyExtras(null, { a: { name: "x", order: 0 } })).toBe(false);
  });
});
