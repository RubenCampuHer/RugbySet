// Espejo de ExerciseRepository.kt / _Exercise.kt (repo Android) — crear,
// editar y borrar ejercicios. Las reglas RTDB de Exercises solo comprueban
// rol (COACH/ADMIN), no autoría: aquí se valida canEditExercise/
// canDeleteExercise ANTES de escribir, cerrando ese hueco en el único punto
// donde podemos hacerlo sin tocar las reglas.
import { get, ref, remove, set, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { auth, db } from "@/lib/firebase";
import { canCreateContent, canDeleteExercise, canEditExercise } from "@/lib/permissions";
import { resizeAndUpload } from "@/lib/storage";
import type { Exercise, User } from "@/lib/types";

export type ExerciseInput = {
  name: string;
  descCorta: string;
  descLarga: string;
  image: string | null;
  privacy: "Publico" | "Privado";
  etiquetas: string[];
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
    // Público siempre pasa a PENDING al guardar (crear o editar) — igual
    // que Android, no se preserva un approvalStatus previo.
    approvalStatus: input.privacy === "Publico" ? "PENDING" : null,
    // El formulario, igual que AddExercise/PopupExercise en Android, no
    // ofrece privacidad "Equipo".
    teamname: null,
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

  const updated = buildExercise(input, original.author!);
  await set(ref(db, `${PATHS.EXERCISES}/${input.name}`), updated);
  if (input.name !== originalName) {
    await remove(ref(db, `${PATHS.EXERCISES}/${originalName}`));
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
