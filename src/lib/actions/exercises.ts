// Espejo de ExerciseRepository.kt / _Exercise.kt (repo Android) — crear,
// editar y borrar ejercicios. Las reglas RTDB de Exercises solo comprueban
// rol (COACH/ADMIN), no autoría: aquí se valida canEditExercise/
// canDeleteExercise ANTES de escribir, cerrando ese hueco en el único punto
// donde podemos hacerlo sin tocar las reglas.
import { get, ref, remove, set, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { auth, db } from "@/lib/firebase";
import { canCreateContent, canDeleteExercise, canEditExercise } from "@/lib/permissions";
import { mergeNode } from "@/lib/rtdb";
import { resizeAndUpload } from "@/lib/storage";
import { findAvailableName } from "@/lib/utils";
import type { Exercise, User } from "@/lib/types";

export type ExerciseInput = {
  name: string;
  descCorta: string;
  descLarga: string;
  image: string | null;
  privacy: "Publico" | "Privado" | "Club";
  etiquetas: string[];
  /** JSON del estado de la pizarra (null si la imagen no viene de ahí). */
  boardData: string | null;
  /**
   * clubId del autor en el momento de guardar — solo relevante si
   * privacy === "Club" (resuelto por la página vía useMyClubId() antes de
   * llamar; snapshot, no se recalcula si el autor cambia de club después,
   * mismo criterio que ya se documentaba para teamname).
   */
  clubId?: string | null;
  /** Solo al copiar de otro autor: de dónde viene. Al editar se omite y se conserva el existente. */
  copiedFrom?: { name: string; author: string };
};

/** Sube la imagen de un ejercicio a exercises_images/{uid}/... (ver storage.rules). */
export async function uploadExerciseImage(uid: string, file: Blob): Promise<string> {
  return resizeAndUpload(`exercises_images/${uid}`, file);
}

// El nombre ES la clave del nodo Exercises/{name} — nunca actualizar la
// clave con un update parcial, siempre set nuevo + remove viejo si cambia
// (espejo de _Exercise.modifyExercise).
function buildExercise(input: ExerciseInput, author: string): Exercise {
  return {
    name: input.name,
    descCorta: input.descCorta,
    descLarga: input.descLarga,
    image: input.image,
    privacy: input.privacy,
    author,
    etiquetas: input.etiquetas,
    created_at: Date.now(),
    // Público y Club pasan a PENDING al guardar (crear o editar) — igual
    // que Android, no se preserva un approvalStatus previo. Club lo
    // aprueba el admin del club (ver database.rules.json), no un ADMIN
    // global.
    approvalStatus: input.privacy === "Publico" || input.privacy === "Club" ? "PENDING" : null,
    teamname: null, // sin uso real — ver comentario en schemas/exercise.ts
    clubId: input.privacy === "Club" ? (input.clubId ?? null) : null,
    boardData: input.boardData,
    ...(input.copiedFrom ? { copiedFrom: input.copiedFrom } : {}),
  };
}

export async function createExercise(input: ExerciseInput, currentUser: User): Promise<void> {
  if (!canCreateContent(currentUser)) {
    throw new Error("Sin permiso para crear ejercicios");
  }
  const exercise = buildExercise(input, currentUser.username!);
  await set(ref(db, `${PATHS.EXERCISES}/${input.name}`), exercise);
}

export async function updateExercise(
  originalName: string,
  input: ExerciseInput,
  currentUser: User,
): Promise<void> {
  const snap = await get(ref(db, `${PATHS.EXERCISES}/${originalName}`));
  const original = snap.val() as Exercise | null;
  if (!original) throw new Error("Ejercicio no encontrado");
  if (!canEditExercise(currentUser, original)) {
    throw new Error("Sin permiso para editar este ejercicio");
  }

  // Fusión sobre el nodo CRUDO (espejo de ExerciseRepository.modifyExercise):
  // se conservan created_at y cualquier clave que este código no conozca
  // (p. ej. `stability`); antes un set() del objeto construido las borraba.
  const merged = mergeNode(original, {
    ...buildExercise(input, original.author!),
    created_at: original.created_at ?? Date.now(),
  });
  if (input.name === originalName) {
    await set(ref(db, `${PATHS.EXERCISES}/${input.name}`), merged);
  } else {
    // Renombrar = una sola escritura multi-path (alta nueva + baja vieja).
    await update(ref(db), {
      [`${PATHS.EXERCISES}/${input.name}`]: merged,
      [`${PATHS.EXERCISES}/${originalName}`]: null,
    });
  }
}

/**
 * Borra el ejercicio y limpia favExercises del usuario que ejecuta la
 * acción si lo tenía marcado (espejo de _Exercise.removeFavExerciseFromAllUsers,
 * que pese al nombre solo limpia al propio usuario autenticado desde la
 * migración de reglas — limpiar los favoritos de otros usuarios requeriría
 * una Cloud Function, pendiente en ambas plataformas).
 */
export async function deleteExercise(exercise: Exercise, currentUser: User): Promise<void> {
  if (!canDeleteExercise(currentUser, exercise)) {
    throw new Error("Sin permiso para eliminar este ejercicio");
  }
  await remove(ref(db, `${PATHS.EXERCISES}/${exercise.name}`));

  const uid = auth.currentUser?.uid;
  const name = exercise.name;
  if (!uid || !name) return;
  const favSnap = await get(ref(db, `${PATHS.USERS}/${uid}/favExercises`));
  const v = favSnap.val();
  const list = (v == null ? [] : Array.isArray(v) ? v : Object.values(v)).filter(
    Boolean,
  ) as string[];
  if (list.includes(name)) {
    await update(ref(db, `${PATHS.USERS}/${uid}`), {
      favExercises: list.filter((n) => n !== name),
    });
  }
}

/**
 * Duplica un ejercicio con el usuario actual como nuevo autor — mejora
 * deliberada sobre PopupExercise.kt (Android), que sobrescribe en
 * silencio si "{name}_copy" ya existe: aquí se prueba con sufijo
 * incremental (_copy2, _copy3...) hasta encontrar un nombre libre.
 */
export async function duplicateExercise(
  exercise: Exercise,
  currentUser: User,
): Promise<string> {
  if (!canCreateContent(currentUser)) {
    throw new Error("Sin permiso para duplicar ejercicios");
  }
  const base = exercise.name ?? "ejercicio";
  const name = await findAvailableName(base, async (candidate) => {
    const snap = await get(ref(db, `${PATHS.EXERCISES}/${candidate}`));
    return snap.exists();
  });
  const privacy = exercise.privacy === "Privado" || exercise.privacy === "Club" ? exercise.privacy : "Publico";
  const duplicate = buildExercise(
    {
      name,
      descCorta: exercise.descCorta ?? "",
      descLarga: exercise.descLarga ?? "",
      image: exercise.image ?? null,
      privacy,
      etiquetas: exercise.etiquetas,
      boardData: exercise.boardData ?? null,
      clubId: privacy === "Club" ? exercise.clubId : null,
    },
    currentUser.username!,
  );
  await set(ref(db, `${PATHS.EXERCISES}/${name}`), duplicate);
  return name;
}
