// Lecciones del club (2026-09-28, solo web): ClubLessons/{clubId}. Lo que
// escribe la dirección va a lessons/ (publicado); lo de un entrenador, a
// pending/ + pendingBy/{uid} hasta que la dirección lo aprueba. Cada carpeta y
// lección guarda su público efectivo (heredado o propio) y un id en index/
// para que los miembros sepan qué pedir. Ficheros en Storage
// club_lessons/{clubId}/{lessonId}/. Reglas: bloque ClubLessons de
// database.rules.json y club_lessons de storage.rules (repo Android).
import { push, ref, update } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { type Audience, sameAudience } from "@/lib/audience";
import { PATHS } from "@/lib/constants";
import { db, storage } from "@/lib/firebase";
import {
  type Folders,
  inheritedAudienceUpdates,
  type Lessons,
  orphanFiles,
  parentAudience,
  resolveAudience,
  validateLessonFile,
} from "@/lib/lessons";
import type { Lesson } from "@/lib/schemas/lesson";
import { deleteFileQuietly } from "@/lib/storage";

const base = (clubId: string) => `${PATHS.CLUB_LESSONS}/${clubId}`;

/** RTDB no admite undefined (los campos opcionales de Zod lo traen): fuera antes de escribir. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function deleteFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => deleteFileQuietly(p)));
}

/** Lo que el cliente ya tiene cargado del club (para heredar y propagar públicos). */
export type LessonsCtx = { folders: Folders; lessons: Lessons; pending: Lessons; uid: string; isDirector: boolean };

/**
 * Rutas que reescribe cambiar el público de `folderId`. Un entrenador solo
 * puede tocar lo suyo: si dentro hay contenido de otros que hereda, lo tiene
 * que cambiar la dirección.
 */
function propagate(ctx: LessonsCtx, folderId: string, audience: Audience): Record<string, Audience> {
  const updates = inheritedAudienceUpdates(ctx.folders, ctx.lessons, ctx.pending, folderId, audience);
  if (!ctx.isDirector) {
    const foreign = Object.keys(updates).some((path) => {
      const [branch, id] = path.split("/");
      const item = branch === "folders" ? ctx.folders[id] : branch === "lessons" ? ctx.lessons[id] : ctx.pending[id];
      return item && item.createdBy !== ctx.uid;
    });
    if (foreign) throw new Error("Dentro hay contenido de otros entrenadores: el público de esta carpeta lo cambia la dirección del club.");
  }
  return updates;
}

const prefixed = (clubId: string, rel: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(rel).map(([k, v]) => [`${base(clubId)}/${k}`, v]));

// ── Carpetas ──

export async function createFolder(
  clubId: string,
  ctx: LessonsCtx,
  name: string,
  parentId: string | null,
  ownAudience: Audience | null,
): Promise<string> {
  const id = push(ref(db, `${base(clubId)}/folders`)).key!;
  const { audience, audienceInherited } = resolveAudience(ctx.folders, parentId, ownAudience);
  await update(ref(db), prefixed(clubId, {
    [`folders/${id}`]: clean({
      name: name.trim().slice(0, 120),
      ...(parentId ? { parentId } : {}),
      createdBy: ctx.uid,
      createdAt: Date.now(),
      audience,
      audienceInherited,
    }),
    [`index/folders/${id}`]: ctx.uid,
  }));
  return id;
}

/** Nombre y público de una carpeta; lo que hereda de ella se actualiza a la vez. */
export async function updateFolder(
  clubId: string,
  ctx: LessonsCtx,
  folderId: string,
  changes: { name: string; ownAudience: Audience | null },
): Promise<void> {
  const folder = ctx.folders[folderId];
  if (!folder) throw new Error("La carpeta ya no existe");
  const { audience, audienceInherited } = resolveAudience(ctx.folders, folder.parentId, changes.ownAudience);
  const rel: Record<string, unknown> = {
    [`folders/${folderId}/name`]: changes.name.trim().slice(0, 120),
    [`folders/${folderId}/audience`]: clean(audience),
    [`folders/${folderId}/audienceInherited`]: audienceInherited,
  };
  if (!sameAudience(folder.audience, audience)) Object.assign(rel, propagate(ctx, folderId, clean(audience)));
  await update(ref(db), prefixed(clubId, rel));
}

export async function moveFolder(clubId: string, ctx: LessonsCtx, folderId: string, parentId: string | null): Promise<void> {
  const folder = ctx.folders[folderId];
  if (!folder) throw new Error("La carpeta ya no existe");
  const rel: Record<string, unknown> = { [`folders/${folderId}/parentId`]: parentId };
  // Si seguía a su carpeta, ahora sigue a la nueva (y lo suyo con ella).
  if (folder.audienceInherited !== false) {
    const audience = clean(parentAudience(ctx.folders, parentId));
    if (!sameAudience(folder.audience, audience)) {
      rel[`folders/${folderId}/audience`] = audience;
      Object.assign(rel, propagate(ctx, folderId, audience));
    }
  }
  await update(ref(db), prefixed(clubId, rel));
}

/** Solo carpetas vacías (lo comprueba quien llama con isFolderEmpty). */
export async function deleteFolder(clubId: string, folderId: string): Promise<void> {
  await update(ref(db), prefixed(clubId, { [`folders/${folderId}`]: null, [`index/folders/${folderId}`]: null }));
}

// ── Lecciones ──

export function newLessonId(clubId: string): string {
  return push(ref(db, `${base(clubId)}/lessons`)).key!;
}

export type LessonDraft = Pick<Lesson, "title" | "folderId" | "blocks"> & { ownAudience: Audience | null };

/**
 * Guarda una lección. La dirección publica directamente (y descarta la
 * versión pendiente, si la había: publicar desde el editor = aprobar con
 * cambios). Un entrenador deja su versión en pending/ y la publicada, si
 * existe, sigue visible hasta que la aprueben. Después borra los ficheros
 * que ya no usa ninguna versión que se queda.
 */
export async function saveLesson(opts: {
  clubId: string;
  lessonId: string;
  ctx: LessonsCtx;
  draft: LessonDraft;
  approved: Lesson | null;
  pending: Lesson | null;
}): Promise<"published" | "pending"> {
  const { clubId, lessonId, ctx, draft, approved, pending } = opts;
  const previous = pending ?? approved;
  const author = previous?.createdBy ?? ctx.uid;
  const now = Date.now();
  const { audience, audienceInherited } = resolveAudience(ctx.folders, draft.folderId, draft.ownAudience);
  const data = clean({
    title: draft.title.trim().slice(0, 120) || "Sin título",
    ...(draft.folderId ? { folderId: draft.folderId } : {}),
    createdBy: author,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    audience,
    audienceInherited,
    blocks: draft.blocks,
  });
  if (ctx.isDirector) {
    await update(ref(db), prefixed(clubId, {
      [`lessons/${lessonId}`]: data,
      [`index/lessons/${lessonId}`]: author,
      [`pending/${lessonId}`]: null,
      [`pendingBy/${author}/${lessonId}`]: null,
    }));
    await deleteFiles([...orphanFiles(approved, [data]), ...orphanFiles(pending, [data])]);
    return "published";
  }
  await update(ref(db), prefixed(clubId, {
    [`pending/${lessonId}`]: data,
    [`pendingBy/${ctx.uid}/${lessonId}`]: true,
  }));
  await deleteFiles(orphanFiles(pending, [data, approved]));
  return "pending";
}

export async function approveLesson(clubId: string, lessonId: string, pending: Lesson, approved: Lesson | null): Promise<void> {
  await update(ref(db), prefixed(clubId, {
    [`lessons/${lessonId}`]: clean({ ...pending, updatedAt: Date.now() }),
    [`index/lessons/${lessonId}`]: pending.createdBy,
    [`pending/${lessonId}`]: null,
    [`pendingBy/${pending.createdBy}/${lessonId}`]: null,
  }));
  await deleteFiles(orphanFiles(approved, [pending]));
}

/** Descarta la versión pendiente; la publicada (si hay) se queda como estaba. */
export async function rejectLesson(clubId: string, lessonId: string, pending: Lesson, approved: Lesson | null): Promise<void> {
  await update(ref(db), prefixed(clubId, {
    [`pending/${lessonId}`]: null,
    [`pendingBy/${pending.createdBy}/${lessonId}`]: null,
  }));
  await deleteFiles(orphanFiles(pending, [approved]));
}

/** Borra la lección entera (publicada y pendiente) y sus ficheros. */
export async function deleteLesson(clubId: string, lessonId: string, approved: Lesson | null, pending: Lesson | null): Promise<void> {
  const author = (pending ?? approved)?.createdBy;
  await update(ref(db), prefixed(clubId, {
    ...(approved ? { [`lessons/${lessonId}`]: null, [`index/lessons/${lessonId}`]: null } : {}),
    ...(pending ? { [`pending/${lessonId}`]: null } : {}),
    ...(pending && author ? { [`pendingBy/${author}/${lessonId}`]: null } : {}),
  }));
  await deleteFiles([...orphanFiles(approved, []), ...orphanFiles(pending, [])]);
}

/** Mover una lección publicada (solo la dirección; un entrenador la mueve editándola). */
export async function moveLesson(clubId: string, ctx: LessonsCtx, lessonId: string, folderId: string | null): Promise<void> {
  const lesson = ctx.lessons[lessonId];
  const rel: Record<string, unknown> = {
    [`lessons/${lessonId}/folderId`]: folderId,
    [`lessons/${lessonId}/updatedAt`]: Date.now(),
  };
  if (lesson && lesson.audienceInherited !== false) rel[`lessons/${lessonId}/audience`] = clean(parentAudience(ctx.folders, folderId));
  await update(ref(db), prefixed(clubId, rel));
}

// ── Ficheros ──

export type UploadedLessonFile = { url: string; path: string; name: string; size: number };

/** Sube un PDF o un vídeo con progreso (0-1). Mismos límites que storage.rules. */
export async function uploadLessonFile(
  clubId: string,
  lessonId: string,
  kind: "pdf" | "video",
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedLessonFile> {
  const error = validateLessonFile(kind, file);
  if (error) throw new Error(error);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || (kind === "pdf" ? "documento.pdf" : "video");
  const path = `club_lessons/${clubId}/${lessonId}/${Date.now()}-${safeName}`;
  const fileRef = storageRef(storage, path);
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  const url = await getDownloadURL(fileRef);
  return { url, path, name: file.name.slice(0, 200), size: file.size };
}

/** Ficheros subidos en el editor que al final no se guardaron. */
export async function discardUploads(paths: string[]): Promise<void> {
  await deleteFiles(paths);
}
