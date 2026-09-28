// Lógica pura de las lecciones del club (2026-09-28): árbol de carpetas,
// migas, bloques y ficheros. Sin Firebase ni React.
import { type Audience, CLUB_AUDIENCE } from "./audience";
import type { Lesson, LessonBlock, LessonFolder } from "./schemas/lesson";

export type Folders = Record<string, LessonFolder>;
export type Lessons = Record<string, Lesson>;

const byName = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });

/** Subcarpetas directas de `parentId` (null = raíz), por nombre. Una carpeta cuyo padre ya no existe cuelga de la raíz. */
export function childFolders(folders: Folders, parentId: string | null): { id: string; folder: LessonFolder }[] {
  return Object.entries(folders)
    .filter(([, f]) => {
      const parent = f.parentId && folders[f.parentId] ? f.parentId : null;
      return parent === parentId;
    })
    .map(([id, folder]) => ({ id, folder }))
    .sort((a, b) => byName(a.folder.name, b.folder.name));
}

/** Lecciones de una carpeta (null = raíz; también las de carpetas borradas), por título. */
export function lessonsIn(lessons: Lessons, folders: Folders, folderId: string | null): { id: string; lesson: Lesson }[] {
  return Object.entries(lessons)
    .filter(([, l]) => (l.folderId && folders[l.folderId] ? l.folderId : null) === folderId)
    .map(([id, lesson]) => ({ id, lesson }))
    .sort((a, b) => byName(a.lesson.title, b.lesson.title));
}

/** Ruta desde la raíz hasta `folderId` (incluida). Corta si encuentra un ciclo. */
export function breadcrumb(folders: Folders, folderId: string | null): { id: string; name: string }[] {
  const path: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let id = folderId;
  while (id && folders[id] && !seen.has(id)) {
    seen.add(id);
    path.unshift({ id, name: folders[id].name });
    id = folders[id].parentId ?? null;
  }
  return path;
}

/** Todas las carpetas por debajo de `folderId` (sin incluirla). */
export function descendantIds(folders: Folders, folderId: string): Set<string> {
  const out = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const { id } of childFolders(folders, current)) {
      if (!out.has(id) && id !== folderId) {
        out.add(id);
        stack.push(id);
      }
    }
  }
  return out;
}

/** Mover una carpeta dentro de sí misma o de una descendiente crearía un ciclo. */
export function canMoveFolder(folders: Folders, folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return true;
  if (newParentId === folderId || !folders[newParentId]) return false;
  return !descendantIds(folders, folderId).has(newParentId);
}

/** Sin subcarpetas ni lecciones (aprobadas o pendientes visibles para quien borra). */
export function isFolderEmpty(folders: Folders, lessons: Lessons[], folderId: string): boolean {
  if (childFolders(folders, folderId).length > 0) return false;
  return lessons.every((map) => Object.values(map).every((l) => l.folderId !== folderId));
}

/** Todas las carpetas como opciones de un selector, con sangría por nivel. */
export function folderOptions(folders: Folders): { id: string; label: string; depth: number }[] {
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const { id, folder } of childFolders(folders, parent)) {
      out.push({ id, label: folder.name, depth });
      walk(id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// ── Bloques ──

export type BlockEntry = { id: string; block: LessonBlock };

export function sortedBlocks(lesson: Pick<Lesson, "blocks">): BlockEntry[] {
  return Object.entries(lesson.blocks)
    .filter((e): e is [string, LessonBlock] => e[1] != null)
    .map(([id, block]) => ({ id, block }))
    .sort((a, b) => a.block.order - b.block.order);
}

/** Sube (-1) o baja (+1) un bloque; fuera de rango no cambia nada. */
export function moveBlock(list: BlockEntry[], index: number, dir: -1 | 1): BlockEntry[] {
  const target = index + dir;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Lista del editor → mapa para RTDB, con `order` renumerado 0..n-1. */
export function toBlocksRecord(list: BlockEntry[]): Record<string, LessonBlock> {
  return Object.fromEntries(list.map(({ id, block }, i) => [id, { ...block, order: i }]));
}

/** Rutas de Storage que usa una lección (PDFs y vídeos subidos). */
export function lessonFiles(lesson: Pick<Lesson, "blocks"> | null | undefined): string[] {
  if (!lesson) return [];
  return sortedBlocks(lesson).flatMap(({ block }) => {
    if (block.type === "pdf") return [block.path];
    if (block.type === "video" && block.source === "file" && block.path) return [block.path];
    return [];
  });
}

/** Ficheros de `removed` que ya no usa ninguna de las versiones que se quedan. */
export function orphanFiles(
  removed: Pick<Lesson, "blocks"> | null | undefined,
  kept: (Pick<Lesson, "blocks"> | null | undefined)[],
): string[] {
  const keep = new Set(kept.flatMap((l) => lessonFiles(l)));
  return lessonFiles(removed).filter((p) => !keep.has(p));
}

export const LESSON_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const LESSON_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/** Mensaje de error si el fichero no vale para ese tipo de bloque (mismos límites que storage.rules). */
export function validateLessonFile(kind: "pdf" | "video", file: { type: string; size: number }): string | null {
  if (kind === "pdf") {
    if (file.type !== "application/pdf") return "Tiene que ser un PDF.";
    if (file.size >= LESSON_PDF_MAX_BYTES) return "El PDF no puede pasar de 20 MB.";
    return null;
  }
  if (!file.type.startsWith("video/")) return "Tiene que ser un vídeo.";
  if (file.size >= LESSON_VIDEO_MAX_BYTES) return "El vídeo no puede pasar de 200 MB.";
  return null;
}

// ── Público heredado (2026-09-28) ──

/** Público que hereda algo que cuelga de `parentId` (null = raíz = todo el club). */
export function parentAudience(folders: Folders, parentId: string | null | undefined): Audience {
  const parent = parentId ? folders[parentId] : null;
  return parent?.audience ?? CLUB_AUDIENCE;
}

/** Público a guardar: el propio si lo tiene, si no el de su carpeta. */
export function resolveAudience(
  folders: Folders,
  parentId: string | null | undefined,
  own: Audience | null,
): { audience: Audience; audienceInherited: boolean } {
  return own ? { audience: own, audienceInherited: false } : { audience: parentAudience(folders, parentId), audienceInherited: true };
}

/**
 * Rutas (relativas a ClubLessons/{clubId}) que hay que reescribir cuando la
 * carpeta `folderId` pasa a tener `audience`: todo lo que cuelga de ella y
 * hereda, recorriendo subcarpetas que también heredan (una con público propio
 * corta la cadena). `pending` son las versiones pendientes que ve quien edita.
 */
export function inheritedAudienceUpdates(
  folders: Folders,
  lessons: Lessons,
  pending: Lessons,
  folderId: string,
  audience: Audience,
): Record<string, Audience> {
  const updates: Record<string, Audience> = {};
  const visit = (parent: string) => {
    for (const { id, folder } of childFolders(folders, parent)) {
      if (folder.audienceInherited === false) continue;
      updates[`folders/${id}/audience`] = audience;
      visit(id);
    }
    for (const [branch, map] of [["lessons", lessons], ["pending", pending]] as const) {
      for (const [id, l] of Object.entries(map)) {
        if (l.folderId === parent && l.audienceInherited !== false) updates[`${branch}/${id}/audience`] = audience;
      }
    }
  };
  visit(folderId);
  return updates;
}
