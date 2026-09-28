// Lecciones del club (2026-09-28, solo web): ClubLessons/{clubId}. Lo que
// escribe la dirección va a lessons/ (publicado); lo de un entrenador, a
// pending/ + pendingBy/{uid} hasta que la dirección lo aprueba. Ficheros en
// Storage club_lessons/{clubId}/{lessonId}/. Reglas: bloque ClubLessons de
// database.rules.json y club_lessons de storage.rules (repo Android).
import { push, ref, set, update } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { PATHS } from "@/lib/constants";
import { db, storage } from "@/lib/firebase";
import { orphanFiles, validateLessonFile } from "@/lib/lessons";
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

// ── Carpetas ──

export async function createFolder(clubId: string, uid: string, name: string, parentId: string | null): Promise<string> {
  const folderRef = push(ref(db, `${base(clubId)}/folders`));
  await set(folderRef, {
    name: name.trim().slice(0, 120),
    ...(parentId ? { parentId } : {}),
    createdBy: uid,
    createdAt: Date.now(),
  });
  return folderRef.key!;
}

export async function renameFolder(clubId: string, folderId: string, name: string): Promise<void> {
  await update(ref(db, `${base(clubId)}/folders/${folderId}`), { name: name.trim().slice(0, 120) });
}

export async function moveFolder(clubId: string, folderId: string, parentId: string | null): Promise<void> {
  await set(ref(db, `${base(clubId)}/folders/${folderId}/parentId`), parentId);
}

/** Solo carpetas vacías (lo comprueba quien llama con isFolderEmpty). */
export async function deleteFolder(clubId: string, folderId: string): Promise<void> {
  await set(ref(db, `${base(clubId)}/folders/${folderId}`), null);
}

// ── Lecciones ──

export function newLessonId(clubId: string): string {
  return push(ref(db, `${base(clubId)}/lessons`)).key!;
}

export type LessonDraft = Pick<Lesson, "title" | "folderId" | "blocks">;

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
  uid: string;
  isDirector: boolean;
  draft: LessonDraft;
  approved: Lesson | null;
  pending: Lesson | null;
}): Promise<"published" | "pending"> {
  const { clubId, lessonId, uid, isDirector, draft, approved, pending } = opts;
  const previous = pending ?? approved;
  const author = previous?.createdBy ?? uid;
  const now = Date.now();
  const data = clean({
    title: draft.title.trim().slice(0, 120) || "Sin título",
    ...(draft.folderId ? { folderId: draft.folderId } : {}),
    createdBy: author,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    blocks: draft.blocks,
  });
  const b = base(clubId);
  if (isDirector) {
    await update(ref(db), {
      [`${b}/lessons/${lessonId}`]: data,
      [`${b}/pending/${lessonId}`]: null,
      [`${b}/pendingBy/${author}/${lessonId}`]: null,
    });
    await deleteFiles([...orphanFiles(approved, [data]), ...orphanFiles(pending, [data])]);
    return "published";
  }
  await update(ref(db), {
    [`${b}/pending/${lessonId}`]: data,
    [`${b}/pendingBy/${uid}/${lessonId}`]: true,
  });
  await deleteFiles(orphanFiles(pending, [data, approved]));
  return "pending";
}

export async function approveLesson(clubId: string, lessonId: string, pending: Lesson, approved: Lesson | null): Promise<void> {
  const b = base(clubId);
  await update(ref(db), {
    [`${b}/lessons/${lessonId}`]: clean({ ...pending, updatedAt: Date.now() }),
    [`${b}/pending/${lessonId}`]: null,
    [`${b}/pendingBy/${pending.createdBy}/${lessonId}`]: null,
  });
  await deleteFiles(orphanFiles(approved, [pending]));
}

/** Descarta la versión pendiente; la publicada (si hay) se queda como estaba. */
export async function rejectLesson(clubId: string, lessonId: string, pending: Lesson, approved: Lesson | null): Promise<void> {
  const b = base(clubId);
  await update(ref(db), {
    [`${b}/pending/${lessonId}`]: null,
    [`${b}/pendingBy/${pending.createdBy}/${lessonId}`]: null,
  });
  await deleteFiles(orphanFiles(pending, [approved]));
}

/** Borra la lección entera (publicada y pendiente) y sus ficheros. */
export async function deleteLesson(clubId: string, lessonId: string, approved: Lesson | null, pending: Lesson | null): Promise<void> {
  const b = base(clubId);
  const author = (pending ?? approved)?.createdBy;
  await update(ref(db), {
    ...(approved ? { [`${b}/lessons/${lessonId}`]: null } : {}),
    ...(pending ? { [`${b}/pending/${lessonId}`]: null } : {}),
    ...(pending && author ? { [`${b}/pendingBy/${author}/${lessonId}`]: null } : {}),
  });
  await deleteFiles([...orphanFiles(approved, []), ...orphanFiles(pending, [])]);
}

/** Mover una lección publicada (solo la dirección; un entrenador la mueve editándola). */
export async function moveLesson(clubId: string, lessonId: string, folderId: string | null): Promise<void> {
  await update(ref(db, `${base(clubId)}/lessons/${lessonId}`), { folderId, updatedAt: Date.now() });
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
