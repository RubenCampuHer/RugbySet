// Vídeo y niveles de un ejercicio (2026-09-29, solo web): ExerciseExtras/{nombre}.
// Quién escribe lo deciden las reglas (ADMIN o el COACH autor del ejercicio);
// aquí se comprueba antes con canEditExercise para dar un error legible.
import { get, ref, update } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { PATHS } from "@/lib/constants";
import {
  cleanExtrasDraft,
  extrasFiles,
  type ExtrasDraft,
  isEmptyExtras,
  toRtdb,
  unusedFiles,
  validateExerciseVideo,
} from "@/lib/exercise-extras";
import { auth, db, storage } from "@/lib/firebase";
import { canEditExercise } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { type ExerciseExtras, ExerciseExtrasSchema } from "@/lib/schemas/exercise-extras";
import { deleteFileQuietly } from "@/lib/storage";
import type { Exercise, User } from "@/lib/types";

export async function getExerciseExtras(name: string): Promise<ExerciseExtras | null> {
  const snap = await get(ref(db, `${PATHS.EXERCISE_EXTRAS}/${name}`));
  return snap.exists() ? parseOr(ExerciseExtrasSchema, snap.val(), `ExerciseExtras/${name}`) : null;
}

/** Todos los extras (para saber si otro ejercicio comparte un vídeo subido). */
async function getAllExtras(): Promise<Record<string, ExerciseExtras | null>> {
  const snap = await get(ref(db, PATHS.EXERCISE_EXTRAS));
  const raw = (snap.val() ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, parseOr(ExerciseExtrasSchema, v, `ExerciseExtras/${k}`)]),
  );
}

/** Borra de Storage los ficheros que ya no usa ningún ejercicio (solo los propios se dejan borrar). */
export async function deleteUnusedVideos(
  paths: string[],
  kept: ExerciseExtras | null,
  exceptName: string | null,
): Promise<void> {
  if (paths.length === 0) return;
  const all = await getAllExtras();
  if (exceptName) delete all[exceptName];
  await Promise.all(unusedFiles(paths, kept, all).map((p) => deleteFileQuietly(p)));
}

export type UploadedVideo = { url: string; path: string; title: string };

/** Sube un vídeo a exercise_videos/{uid}/ con progreso (0-1). Mismos límites que storage.rules. */
export async function uploadExerciseVideo(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedVideo> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No autenticado");
  const error = validateExerciseVideo(file);
  if (error) throw new Error(error);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "video";
  const path = `exercise_videos/${uid}/${Date.now()}-${safeName}`;
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
  return { url: await getDownloadURL(fileRef), path, title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) };
}

/**
 * Guarda el vídeo y los niveles del ejercicio. Sin nada que guardar borra el
 * nodo. Después borra los vídeos subidos que ya no usa nadie: los que había
 * antes y los que se subieron en el editor y al final no se quedaron.
 */
export async function saveExerciseExtras(
  exercise: Exercise,
  draft: ExtrasDraft,
  uploadedInEditor: string[],
  currentUser: User,
): Promise<void> {
  const name = exercise.name;
  const uid = auth.currentUser?.uid;
  if (!name || !uid) throw new Error("No autenticado");
  if (!canEditExercise(currentUser, exercise)) throw new Error("Sin permiso para editar este ejercicio");
  const clean = cleanExtrasDraft(draft);
  if (!clean.ok) throw new Error(clean.error);

  const before = await getExerciseExtras(name);
  const value = isEmptyExtras(clean.video, clean.levels) ? null : toRtdb(clean.video, clean.levels, uid, Date.now());
  await update(ref(db), { [`${PATHS.EXERCISE_EXTRAS}/${name}`]: value });

  const kept = value ? ExerciseExtrasSchema.parse(value) : null;
  await deleteUnusedVideos([...extrasFiles(before), ...uploadedInEditor], kept, name);
}

/**
 * Rutas para copiar los extras de `from` a un ejercicio nuevo `to` en la misma
 * escritura multi-path que lo crea (las reglas miran el autor en newData).
 * Los vídeos subidos se comparten, no se duplican en Storage.
 */
export async function extrasCopyPaths(from: string, to: string): Promise<Record<string, unknown>> {
  const uid = auth.currentUser?.uid;
  const src = await getExerciseExtras(from);
  if (!uid || !src) return {};
  const levels = Object.fromEntries(
    Object.entries(src.levels).filter((e): e is [string, NonNullable<(typeof e)[1]>] => e[1] != null),
  );
  if (isEmptyExtras(src.video ?? null, levels)) return {};
  return { [`${PATHS.EXERCISE_EXTRAS}/${to}`]: toRtdb(src.video ?? null, levels, uid, Date.now()) };
}

/**
 * Tras renombrar un ejercicio, los niveles de otros ejercicios que lo enlazan
 * (ref) pasan al nombre nuevo. Solo se puede donde las reglas dejan escribir
 * (extras de mis ejercicios, o todos si soy ADMIN); el resto queda "ya no existe".
 */
export async function renameLevelRefs(oldName: string, newName: string): Promise<void> {
  const all = await getAllExtras();
  await Promise.all(
    Object.entries(all).map(async ([base, x]) => {
      if (!x) return;
      const paths: Record<string, unknown> = {};
      for (const [id, level] of Object.entries(x.levels)) {
        if (level?.ref === oldName) paths[`${PATHS.EXERCISE_EXTRAS}/${base}/levels/${id}/ref`] = newName;
      }
      if (Object.keys(paths).length) await update(ref(db), paths).catch(() => {});
    }),
  );
}
