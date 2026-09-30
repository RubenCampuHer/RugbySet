import { describe, expect, it } from "vitest";
import { TeamDocsSpaceSchema } from "./schemas/team-docs";
import {
  allowedSpaces,
  breadcrumbOf,
  canMoveFolderTo,
  contentsOf,
  countIn,
  docFiles,
  fileKind,
  folderMovePaths,
  formatBytes,
  mergeSpaces,
  spaceMovePaths,
  subtreeOf,
  validateTeamFile,
} from "./team-docs";

const folder = (name: string, parentId?: string) => ({ name, parentId, createdBy: "u", createdAt: 1 });
const doc = (title: string, folderId?: string, blocks = {}) => ({ title, folderId, createdBy: "u", createdAt: 1, updatedAt: 1, blocks });
const file = (name: string, folderId?: string) => ({ name, folderId, url: "https://s/x", path: `team_docs/T/${name}`, createdBy: "u", createdAt: 1 });

// Equipo:  Sistemas/ (con "Salida de melé" y el archivo plan.pdf) · "Normas"
// Staff:   Análisis/ (con Rival/ y "Notas") · Sistemas/Privado/ (staff dentro de una carpeta del equipo)
const team = TeamDocsSpaceSchema.parse({
  folders: { sis: folder("Sistemas") },
  docs: { mele: doc("Salida de melé", "sis"), normas: doc("Normas") },
  files: { plan: file("plan.pdf", "sis") },
});
const staff = TeamDocsSpaceSchema.parse({
  folders: { ana: folder("Análisis"), rival: folder("Rival", "ana"), priv: folder("Privado", "sis") },
  docs: { notas: doc("Notas", "rival", { b: { type: "pdf", order: 0, url: "https://s/a", path: "team_docs/T/a.pdf", name: "a.pdf" } }) },
});
const m = mergeSpaces(team, staff);

describe("mergeSpaces y contentsOf", () => {
  it("cada elemento conoce su espacio", () => {
    expect(m.folders.ana.space).toBe("staff");
    expect(m.docs.normas.space).toBe("team");
  });
  it("raíz y carpeta, ordenado por nombre", () => {
    const root = contentsOf(m, null);
    expect(root.folders.map((f) => f.id)).toEqual(["ana", "sis"]);
    expect(root.docs.map((d) => d.id)).toEqual(["normas"]);
    const sis = contentsOf(m, "sis");
    expect(sis.folders.map((f) => f.id)).toEqual(["priv"]);
    expect(sis.docs.map((d) => d.id)).toEqual(["mele"]);
    expect(sis.files.map((f) => f.id)).toEqual(["plan"]);
    expect(countIn(m, "sis")).toBe(3);
  });
  it("sin el espacio staff (un jugador), lo de una carpeta invisible sale en la raíz", () => {
    const soloEquipo = mergeSpaces(team, null);
    expect(contentsOf(soloEquipo, null).folders.map((f) => f.id)).toEqual(["sis"]);
  });
});

describe("breadcrumbOf y subtreeOf", () => {
  it("ruta de la raíz a la carpeta", () => {
    expect(breadcrumbOf(m, "rival")).toEqual([
      { id: "ana", name: "Análisis" },
      { id: "rival", name: "Rival" },
    ]);
    expect(breadcrumbOf(m, null)).toEqual([]);
  });
  it("subárbol completo", () => {
    expect(subtreeOf(m, "ana")).toEqual({ folders: ["ana", "rival"], docs: ["notas"], files: [] });
  });
});

describe("visibilidad", () => {
  it("en una carpeta del cuerpo técnico solo cabe cuerpo técnico", () => {
    expect(allowedSpaces(m, "ana")).toEqual(["staff"]);
    expect(allowedSpaces(m, "sis")).toEqual(["team", "staff"]);
    expect(allowedSpaces(m, null)).toEqual(["team", "staff"]);
  });
  it("pasar una carpeta al cuerpo técnico se lleva lo de dentro", () => {
    const p = spaceMovePaths("T", m, "folder", "sis", "staff");
    expect(Object.keys(p).sort()).toEqual([
      "TeamDocs/T/staff/docs/mele",
      "TeamDocs/T/staff/files/plan",
      "TeamDocs/T/staff/folders/sis",
      "TeamDocs/T/team/docs/mele",
      "TeamDocs/T/team/files/plan",
      "TeamDocs/T/team/folders/sis",
    ]);
    expect(p["TeamDocs/T/team/docs/mele"]).toBeNull();
  });
  it("pasar una carpeta al equipo va sola", () => {
    const p = spaceMovePaths("T", m, "folder", "ana", "team");
    expect(Object.keys(p).sort()).toEqual(["TeamDocs/T/staff/folders/ana", "TeamDocs/T/team/folders/ana"]);
  });
  it("sin cambio no escribe nada", () => {
    expect(spaceMovePaths("T", m, "doc", "normas", "team")).toEqual({});
  });
});

describe("mover de carpeta", () => {
  it("no dentro de sí misma", () => {
    expect(canMoveFolderTo(m, "ana", "rival")).toBe(false);
    expect(canMoveFolderTo(m, "ana", "sis")).toBe(true);
    expect(canMoveFolderTo(m, "ana", null)).toBe(true);
  });
  it("a una carpeta del equipo: solo cambia folderId", () => {
    expect(folderMovePaths("T", m, "doc", "normas", "sis")).toEqual({ "TeamDocs/T/team/docs/normas/folderId": "sis" });
  });
  it("a una carpeta del cuerpo técnico: pasa al cuerpo técnico", () => {
    const p = folderMovePaths("T", m, "doc", "normas", "ana");
    expect(p["TeamDocs/T/team/docs/normas"]).toBeNull();
    expect(p["TeamDocs/T/staff/docs/normas"]).toMatchObject({ title: "Normas", folderId: "ana" });
  });
});

describe("archivos", () => {
  it("docFiles", () => {
    expect(docFiles(m.docs.notas.item)).toEqual(["team_docs/T/a.pdf"]);
    expect(docFiles(null)).toEqual([]);
  });
  it("fileKind por tipo o extensión", () => {
    expect(fileKind("application/pdf", "x")).toBe("pdf");
    expect(fileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx")).toBe("word");
    expect(fileKind("", "plan.xlsx")).toBe("sheet");
    expect(fileKind(null, "charla.pptx")).toBe("slides");
    expect(fileKind("image/png", "a.png")).toBe("image");
    expect(fileKind("", "raro.xyz")).toBe("other");
  });
  it("tamaños", () => {
    expect(formatBytes(1536)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
    expect(validateTeamFile({ size: 200 * 1024 * 1024 })).toMatch(/200 MB/);
    expect(validateTeamFile({ size: 10 })).toBeNull();
  });
});
