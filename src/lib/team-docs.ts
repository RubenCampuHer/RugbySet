// Lógica pura de los documentos del equipo (2026-09-30). Dos espacios en
// TeamDocs/{equipo}: "team" (todo el equipo) y "staff" (solo cuerpo técnico).
// Cambiar la visibilidad de algo = moverlo de un espacio a otro.
import { PATHS } from "@/lib/constants";
import type { TeamDoc, TeamDocFolder, TeamDocSpace, TeamDocsSpaceData, TeamFile } from "@/lib/schemas/team-docs";

export const TEAM_FILE_MAX_BYTES = 200 * 1024 * 1024;

export type Located<T> = { id: string; space: TeamDocSpace; item: T };
export type MergedDocs = {
  folders: Record<string, Located<TeamDocFolder>>;
  docs: Record<string, Located<TeamDoc>>;
  files: Record<string, Located<TeamFile>>;
};
export type ItemKind = "folder" | "doc" | "file";

const EMPTY: TeamDocsSpaceData = { folders: {}, docs: {}, files: {} };

/** Los dos espacios juntos, cada elemento con su espacio (los ids son únicos entre los dos). */
export function mergeSpaces(team: TeamDocsSpaceData | null, staff: TeamDocsSpaceData | null): MergedDocs {
  const out: MergedDocs = { folders: {}, docs: {}, files: {} };
  for (const [space, data] of [["team", team ?? EMPTY], ["staff", staff ?? EMPTY]] as const) {
    for (const [id, f] of Object.entries(data.folders)) if (f) out.folders[id] = { id, space, item: f };
    for (const [id, d] of Object.entries(data.docs)) if (d) out.docs[id] = { id, space, item: d };
    for (const [id, f] of Object.entries(data.files)) if (f) out.files[id] = { id, space, item: f };
  }
  return out;
}

/** Carpeta existente o la raíz (una carpeta que no veo cuenta como raíz). */
const parentOf = (m: MergedDocs, id: string | null | undefined): string | null => (id && m.folders[id] ? id : null);

const byName = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });

export function contentsOf(m: MergedDocs, folderId: string | null) {
  return {
    folders: Object.values(m.folders)
      .filter((f) => parentOf(m, f.item.parentId) === folderId)
      .sort((a, b) => byName(a.item.name, b.item.name)),
    docs: Object.values(m.docs)
      .filter((d) => parentOf(m, d.item.folderId) === folderId)
      .sort((a, b) => byName(a.item.title, b.item.title)),
    files: Object.values(m.files)
      .filter((f) => parentOf(m, f.item.folderId) === folderId)
      .sort((a, b) => byName(a.item.name, b.item.name)),
  };
}

export function countIn(m: MergedDocs, folderId: string): number {
  const c = contentsOf(m, folderId);
  return c.folders.length + c.docs.length + c.files.length;
}

/** De la raíz a la carpeta (sin la raíz). Corta ciclos por si acaso. */
export function breadcrumbOf(m: MergedDocs, folderId: string | null): { id: string; name: string }[] {
  const path: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let cur = parentOf(m, folderId);
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.unshift({ id: cur, name: m.folders[cur].item.name });
    cur = parentOf(m, m.folders[cur].item.parentId);
  }
  return path;
}

/** La carpeta y todo lo que cuelga de ella. */
export function subtreeOf(m: MergedDocs, folderId: string): { folders: string[]; docs: string[]; files: string[] } {
  const folders = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of Object.values(m.folders)) {
      if (!folders.has(f.id) && f.item.parentId && folders.has(f.item.parentId)) {
        folders.add(f.id);
        grew = true;
      }
    }
  }
  return {
    folders: [...folders],
    docs: Object.values(m.docs).filter((d) => d.item.folderId && folders.has(d.item.folderId)).map((d) => d.id),
    files: Object.values(m.files).filter((f) => f.item.folderId && folders.has(f.item.folderId)).map((f) => f.id),
  };
}

/**
 * Visibilidades posibles dentro de una carpeta: en una carpeta del cuerpo
 * técnico todo es del cuerpo técnico (el equipo no la ve, no llegaría a lo de dentro).
 */
export function allowedSpaces(m: MergedDocs, folderId: string | null): TeamDocSpace[] {
  const parent = parentOf(m, folderId);
  return parent && m.folders[parent].space === "staff" ? ["staff"] : ["team", "staff"];
}

const collection = { folder: "folders", doc: "docs", file: "files" } as const;
const locate = (m: MergedDocs, kind: ItemKind, id: string) =>
  (kind === "folder" ? m.folders[id] : kind === "doc" ? m.docs[id] : m.files[id]) as Located<Record<string, unknown>> | undefined;

/**
 * Escritura multi-path para poner un elemento en otro espacio. Una carpeta que
 * pasa al cuerpo técnico se lleva todo lo de dentro; una que pasa al equipo va
 * sola (lo de dentro conserva su visibilidad).
 */
export function spaceMovePaths(teamname: string, m: MergedDocs, kind: ItemKind, id: string, to: TeamDocSpace): Record<string, unknown> {
  const base = `${PATHS.TEAM_DOCS}/${teamname}`;
  const paths: Record<string, unknown> = {};
  const move = (k: ItemKind, itemId: string) => {
    const it = locate(m, k, itemId);
    if (!it || it.space === to) return;
    paths[`${base}/${it.space}/${collection[k]}/${itemId}`] = null;
    paths[`${base}/${to}/${collection[k]}/${itemId}`] = it.item;
  };
  if (kind === "folder" && to === "staff") {
    const sub = subtreeOf(m, id);
    sub.folders.forEach((f) => move("folder", f));
    sub.docs.forEach((d) => move("doc", d));
    sub.files.forEach((f) => move("file", f));
  } else {
    move(kind, id);
  }
  return paths;
}

/** ¿Se puede mover la carpeta ahí? No dentro de sí misma ni de sus hijas. */
export function canMoveFolderTo(m: MergedDocs, folderId: string, target: string | null): boolean {
  if (target === null) return true;
  return !subtreeOf(m, folderId).folders.includes(target);
}

/**
 * Mover a otra carpeta. Si la carpeta de destino es del cuerpo técnico, lo que
 * se mueve pasa también al cuerpo técnico.
 */
export function folderMovePaths(teamname: string, m: MergedDocs, kind: ItemKind, id: string, target: string | null): Record<string, unknown> {
  const it = locate(m, kind, id);
  if (!it) return {};
  const field = kind === "folder" ? "parentId" : "folderId";
  const moved = { ...it.item, [field]: target };
  const forced = allowedSpaces(m, target).length === 1 ? "staff" : null;
  if (!forced || it.space === forced) {
    return { [`${PATHS.TEAM_DOCS}/${teamname}/${it.space}/${collection[kind]}/${id}/${field}`]: target };
  }
  // Pasa a staff: primero la nueva ubicación, luego el traslado de espacio.
  const next: MergedDocs = {
    ...m,
    [collection[kind]]: { ...m[collection[kind]], [id]: { ...it, item: moved } },
  } as MergedDocs;
  return spaceMovePaths(teamname, next, kind, id, "staff");
}

/** Ficheros de Storage de un documento (PDF y vídeos subidos). */
export function docFiles(doc: Pick<TeamDoc, "blocks"> | null | undefined): string[] {
  if (!doc) return [];
  return Object.values(doc.blocks).flatMap((b) => {
    if (!b) return [];
    if (b.type === "pdf") return [b.path];
    if (b.type === "video" && b.source === "file" && b.path) return [b.path];
    return [];
  });
}

export type FileKind = "pdf" | "image" | "video" | "audio" | "word" | "sheet" | "slides" | "archive" | "other";

/** Tipo del archivo para el icono, por su tipo MIME o, si falta, por la extensión. */
export function fileKind(contentType: string | null | undefined, name: string): FileKind {
  const t = (contentType ?? "").toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (t === "application/pdf" || ext === "pdf") return "pdf";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (/word|opendocument\.text|rtf/.test(t) || ["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (/sheet|excel|csv/.test(t) || ["xls", "xlsx", "ods", "csv"].includes(ext)) return "sheet";
  if (/presentation|powerpoint/.test(t) || ["ppt", "pptx", "odp", "key"].includes(ext)) return "slides";
  if (/zip|compressed|x-7z|x-rar/.test(t) || ["zip", "rar", "7z"].includes(ext)) return "archive";
  return "other";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function validateTeamFile(file: { size: number }): string | null {
  return file.size >= TEAM_FILE_MAX_BYTES ? "El archivo no puede pasar de 200 MB." : null;
}

/** URL de la lista con el equipo explícito (si lo hay) y la carpeta. */
export function teamDocsHref(team: string | null, folder: string | null, page = "") {
  const q = new URLSearchParams();
  if (team) q.set("team", team);
  if (folder) q.set("folder", folder);
  const s = q.toString();
  return `/team/docs${page}${s ? `?${s}` : ""}`;
}
