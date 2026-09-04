// Acciones sobre el perfil de una persona (nombre, foto) — 2026-09-04. Hasta
// ahora la web no permitía editar ninguna de las dos ("se editan desde
// Android"); con rosters por uid (ver schemas/team.ts) renombrar a alguien
// ya no desincroniza ningún roster, el nombre se resuelve siempre en vivo
// vía publicProfiles.
import { ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { PATHS } from "@/lib/constants";
import { resizeAndUpload } from "@/lib/storage";

/**
 * Cambia el nombre y apellidos de `targetUid` — válido para la propia
 * persona, el coach del equipo ACTIVO de esa persona, o un ADMIN; la regla
 * de Users/{uid}/nameSurname decide, este cliente no distingue casos.
 * mirrorPublicProfile (Cloud Function) propaga el cambio a publicProfiles
 * sin nada adicional.
 */
export async function updateNameSurname(targetUid: string, name: string): Promise<void> {
  await update(ref(db, `${PATHS.USERS}/${targetUid}`), { nameSurname: name.trim() });
}

/**
 * Cambia la foto de perfil de `targetUid` — SOLO la propia persona (decisión
 * de producto 2026-09-04: a diferencia del nombre, sin excepción para
 * coach/ADMIN). Sube a user_images/{uid}/... (storage.rules exige
 * request.auth.uid == uid en esa ruta) y actualiza Users/{uid}/usericon —
 * cubierto por el .write del propio dueño, sin regla nueva.
 */
export async function updateOwnPhoto(uid: string, file: File): Promise<void> {
  const url = await resizeAndUpload(`user_images/${uid}`, file);
  await update(ref(db, `${PATHS.USERS}/${uid}`), { usericon: url });
}
