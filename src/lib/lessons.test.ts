import { describe, expect, it } from "vitest";
import {
  breadcrumb,
  canMoveFolder,
  childFolders,
  folderOptions,
  isFolderEmpty,
  lessonFiles,
  lessonsIn,
  moveBlock,
  orphanFiles,
  sortedBlocks,
  toBlocksRecord,
  validateLessonFile,
  type Folders,
  type Lessons,
} from "./lessons";
import { LessonSchema, parseMap } from "./schemas/lesson";
import type { Lesson } from "./schemas/lesson";

const folder = (name: string, parentId: string | null = null) => ({ name, parentId, createdBy: "u", createdAt: 1 });
const folders: Folders = {
  a: folder("Placaje"),
  b: folder("Ataque"),
  a1: folder("Técnica", "a"),
  a1x: folder("Básico", "a1"),
  orphan: folder("Huérfana", "borrada"),
};
const lesson = (title: string, folderId: string | null, blocks: Lesson["blocks"] = {}): Lesson => ({
  title,
  folderId,
  createdBy: "u",
  createdAt: 1,
  updatedAt: 1,
  blocks,
});

describe("carpetas", () => {
  it("hijas por nombre; la de padre borrado cuelga de la raíz", () => {
    expect(childFolders(folders, null).map((f) => f.id)).toEqual(["b", "orphan", "a"]);
    expect(childFolders(folders, "a").map((f) => f.id)).toEqual(["a1"]);
  });

  it("migas de la raíz a la carpeta", () => {
    expect(breadcrumb(folders, "a1x").map((c) => c.name)).toEqual(["Placaje", "Técnica", "Básico"]);
    expect(breadcrumb(folders, null)).toEqual([]);
  });

  it("migas no se cuelgan con un ciclo", () => {
    const loop: Folders = { x: folder("X", "y"), y: folder("Y", "x") };
    expect(breadcrumb(loop, "x").length).toBe(2);
  });

  it("no se puede mover dentro de sí misma ni de una descendiente", () => {
    expect(canMoveFolder(folders, "a", "a")).toBe(false);
    expect(canMoveFolder(folders, "a", "a1x")).toBe(false);
    expect(canMoveFolder(folders, "a1x", "b")).toBe(true);
    expect(canMoveFolder(folders, "a1", null)).toBe(true);
    expect(canMoveFolder(folders, "a1", "no-existe")).toBe(false);
  });

  it("vacía = sin subcarpetas ni lecciones (aprobadas o pendientes)", () => {
    const approved: Lessons = { l1: lesson("L1", "b") };
    const pending: Lessons = { p1: lesson("P1", "a1x") };
    expect(isFolderEmpty(folders, [approved, pending], "a")).toBe(false); // tiene a1
    expect(isFolderEmpty(folders, [approved, pending], "b")).toBe(false); // tiene L1
    expect(isFolderEmpty(folders, [approved, pending], "a1x")).toBe(false); // pendiente
    expect(isFolderEmpty(folders, [approved], "a1x")).toBe(true);
  });

  it("opciones del selector en orden de árbol con nivel", () => {
    expect(folderOptions(folders).map((o) => `${o.depth}:${o.label}`)).toEqual([
      "0:Ataque",
      "0:Huérfana",
      "0:Placaje",
      "1:Técnica",
      "2:Básico",
    ]);
  });

  it("lecciones de carpetas borradas salen en la raíz", () => {
    const ls: Lessons = { l1: lesson("Zeta", null), l2: lesson("Alfa", "borrada"), l3: lesson("Beta", "a") };
    expect(lessonsIn(ls, folders, null).map((l) => l.lesson.title)).toEqual(["Alfa", "Zeta"]);
    expect(lessonsIn(ls, folders, "a").map((l) => l.id)).toEqual(["l3"]);
  });
});

describe("bloques", () => {
  const blocks: Lesson["blocks"] = {
    z: { type: "text", order: 2, text: "tres" },
    y: { type: "pdf", order: 0, url: "u", path: "club_lessons/c/l/a.pdf", name: "a.pdf", size: 1 },
    x: { type: "video", order: 1, source: "file", url: "u", path: "club_lessons/c/l/v.mp4" },
    w: { type: "video", order: 3, source: "link", url: "https://youtu.be/x" },
  };

  it("ordenados por order", () => {
    expect(sortedBlocks({ blocks }).map((b) => b.id)).toEqual(["y", "x", "z", "w"]);
  });

  it("subir/bajar y renumerar", () => {
    const list = sortedBlocks({ blocks });
    const moved = moveBlock(list, 0, 1);
    expect(moved.map((b) => b.id)).toEqual(["x", "y", "z", "w"]);
    expect(moveBlock(list, 0, -1)).toBe(list);
    const rec = toBlocksRecord(moved);
    expect(Object.entries(rec).map(([id, b]) => `${id}${b.order}`)).toEqual(["x0", "y1", "z2", "w3"]);
  });

  it("ficheros: PDFs y vídeos subidos, no los enlaces", () => {
    expect(lessonFiles({ blocks })).toEqual(["club_lessons/c/l/a.pdf", "club_lessons/c/l/v.mp4"]);
  });

  it("huérfanos: los que ninguna versión que se queda usa", () => {
    const approved = { blocks: { y: blocks.y } };
    expect(orphanFiles({ blocks }, [approved])).toEqual(["club_lessons/c/l/v.mp4"]);
    expect(orphanFiles({ blocks }, [])).toHaveLength(2);
  });

  it("valida tipo y tamaño como storage.rules", () => {
    expect(validateLessonFile("pdf", { type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateLessonFile("pdf", { type: "image/png", size: 1000 })).toMatch(/PDF/);
    expect(validateLessonFile("pdf", { type: "application/pdf", size: 21 * 1024 * 1024 })).toMatch(/20 MB/);
    expect(validateLessonFile("video", { type: "video/mp4", size: 1000 })).toBeNull();
    expect(validateLessonFile("video", { type: "video/mp4", size: 201 * 1024 * 1024 })).toMatch(/200 MB/);
  });
});

describe("esquema", () => {
  it("descarta bloques rotos y lecciones sin autor", () => {
    const parsed = parseMap(LessonSchema, {
      ok: { title: "T", createdBy: "u", createdAt: 1, updatedAt: 1, blocks: { a: { type: "text", order: 0, text: "x" }, b: { type: "exe", order: 1 } } },
      bad: { title: "Sin autor" },
    });
    expect(Object.keys(parsed)).toEqual(["ok"]);
    expect(sortedBlocks(parsed.ok).map((b) => b.id)).toEqual(["a"]);
  });
});

describe("bloques de la biblioteca (ejercicio/entreno)", () => {
  it("se parsean con su ref y no aportan ficheros", () => {
    const parsed = parseMap(LessonSchema, {
      l: {
        title: "T",
        createdBy: "u",
        createdAt: 1,
        updatedAt: 1,
        blocks: {
          a: { type: "exercise", order: 0, ref: "Placaje 1v1" },
          b: { type: "training", order: 1, ref: "Sesión martes" },
          c: { type: "exercise", order: 2, ref: "" },
        },
      },
    });
    const blocks = sortedBlocks(parsed.l);
    expect(blocks.map((b) => `${b.block.type}:${"ref" in b.block ? b.block.ref : ""}`)).toEqual([
      "exercise:Placaje 1v1",
      "training:Sesión martes",
    ]);
    expect(lessonFiles(parsed.l)).toEqual([]);
  });
});
