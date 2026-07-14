// Espejo de TrainingRepository.kt / _Training.kt (repo Android) — crear,
// editar y borrar entrenamientos. Misma validación server-side de permisos
// que exercises.ts (las reglas RTDB de Trainings solo comprueban rol).
import { get, ref, remove, set, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { auth, db } from "@/lib/firebase";
import { canCreateContent, canDeleteTraining, canEditTraining } from "@/lib/permissions";
import type { Section, Training, User } from "@/lib/types";

export type TrainingInput = {
  name: string;
  descCorta: string;
  sections: Section[];
  privacy: "Publico" | "Privado";
  etiquetas: string[];
};

/**
 * Recalcula `order` (posición en el array) y `tiempoSeccion` (suma de
 * tiempoExercise) de cada sección al guardar. Android solo lo hace al
 * editar (PopupTraining.kt) y no al crear (AddTraining.kt) — aquí se
 * aplica siempre, cerrando esa inconsistencia.
 */
function normalizeSections(sections: Section[]): Section[] {
  return sections.map((section) => {
    const exercises = section.exercises.map((et, index) => ({ ...et, order: index }));
    const tiempoSeccion = exercises.reduce((sum, et) => sum + (et.tiempoExercise ?? 0), 0);
    return { ...section, exercises, tiempoSeccion };
  });
}

// El nombre ES la clave del nodo Trainings/{name} — nunca actualizar la
// clave con un update parcial, siempre set nuevo + remove viejo si cambia
// (espejo de _Training.modifyTraining).
function buildTraining(input: TrainingInput, author: string): Training {
  const sections = normalizeSections(input.sections);
  const tiempoTotal = sections.reduce((sum, s) => sum + s.tiempoSeccion, 0);
  return {
    name: input.name,
    descCorta: input.descCorta,
    tiempoTotal: String(tiempoTotal), // Android guarda tiempoTotal como string
    sections,
    privacy: input.privacy,
    author,
    etiquetas: input.etiquetas,
    created_at: Date.now(),
    // Público siempre pasa a PENDING al guardar (crear o editar) — igual
    // que Android, no se preserva un approvalStatus previo.
    approvalStatus: input.privacy === "Publico" ? "PENDING" : null,
    // El formulario, igual que AddTraining/PopupTraining en Android, no
    // ofrece privacidad "Equipo".
    teamname: null,
  };
}

export async function createTraining(input: TrainingInput, currentUser: User): Promise<void> {
  if (!canCreateContent(currentUser)) {
    throw new Error("Sin permiso para crear entrenamientos");
  }
  const training = buildTraining(input, currentUser.username!);
  await set(ref(db, `${PATHS.TRAININGS}/${input.name}`), training);
}

export async function updateTraining(
  originalName: string,
  input: TrainingInput,
  currentUser: User,
): Promise<void> {
  const snap = await get(ref(db, `${PATHS.TRAININGS}/${originalName}`));
  const original = snap.val() as Training | null;
  if (!original) throw new Error("Entrenamiento no encontrado");
  if (!canEditTraining(currentUser, original)) {
    throw new Error("Sin permiso para editar este entrenamiento");
  }

  const updated = buildTraining(input, original.author!);
  await set(ref(db, `${PATHS.TRAININGS}/${input.name}`), updated);
  if (input.name !== originalName) {
    await remove(ref(db, `${PATHS.TRAININGS}/${originalName}`));
  }
}

/**
 * Borra el entrenamiento y limpia favTrainings del usuario que ejecuta la
 * acción si lo tenía marcado (espejo de _Training.removeFavTrainingFromAllUsers,
 * que pese al nombre solo limpia al propio usuario autenticado).
 */
export async function deleteTraining(training: Training, currentUser: User): Promise<void> {
  if (!canDeleteTraining(currentUser, training)) {
    throw new Error("Sin permiso para eliminar este entrenamiento");
  }
  await remove(ref(db, `${PATHS.TRAININGS}/${training.name}`));

  const uid = auth.currentUser?.uid;
  const name = training.name;
  if (!uid || !name) return;
  const favSnap = await get(ref(db, `${PATHS.USERS}/${uid}/favTrainings`));
  const v = favSnap.val();
  const list = (v == null ? [] : Array.isArray(v) ? v : Object.values(v)).filter(
    Boolean,
  ) as string[];
  if (list.includes(name)) {
    await update(ref(db, `${PATHS.USERS}/${uid}`), {
      favTrainings: list.filter((n) => n !== name),
    });
  }
}
