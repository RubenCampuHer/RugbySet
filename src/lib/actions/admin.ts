// Acciones de ADMIN — las reglas RTDB validan el rol del caller en servidor
// (role .write ADMIN; approvalStatus .write ADMIN).
import { ref, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { PATHS } from "@/lib/constants";
import { db, functions } from "@/lib/firebase";

export async function updateApprovalStatus(
  kind: "exercise" | "training",
  name: string,
  status: "APPROVED" | "REJECTED",
) {
  const node = kind === "exercise" ? PATHS.EXERCISES : PATHS.TRAININGS;
  await update(ref(db, `${node}/${name}`), { approvalStatus: status });
}

export async function updateUserRole(
  targetUid: string,
  role: "ADMIN" | "COACH" | "PLAYER",
) {
  await update(ref(db, `${PATHS.USERS}/${targetUid}`), { role });
}

/**
 * Elimina la cuenta de OTRO usuario vía la Cloud Function adminDeleteUser:
 * borra su nodo Users, sus imágenes en Storage y su cuenta de Firebase Auth
 * — esto último no tiene equivalente en el SDK cliente para un uid que no
 * es el propio, así que no hay alternativa client-side. Si el usuario es
 * entrenador de un equipo activo, la función lanza "failed-precondition".
 */
export async function deleteUser(targetUid: string): Promise<void> {
  await httpsCallable(functions, "adminDeleteUser")({ uid: targetUid });
}
