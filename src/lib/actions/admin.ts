// Acciones de ADMIN — las reglas RTDB validan el rol del caller en servidor
// (role .write ADMIN; approvalStatus .write ADMIN).
import { ref, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { PATHS } from "@/lib/constants";
import { hasActiveTeam } from "@/lib/actions/team";
import type { MemberRole } from "@/lib/admin-members";
import { db, functions } from "@/lib/firebase";
import type { Team } from "@/lib/types";

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

/**
 * ADMIN añade a cualquier persona a un equipo (2026-09-28) como jugador,
 * co-entrenador o delegado, sin que lo pida: una escritura multi-path como
 * aceptar una solicitud (sale de pendientes, entra en el roster y en
 * UserTeams) y, si no tenía equipo activo, pasa a ser este. Las reglas ya lo
 * permiten al ADMIN (Teams, UserTeams y Users/{uid}/teamname). El rol global
 * no cambia (igual que ascender a co-entrenador).
 */
export async function adminAddMember(team: Team, uid: string, role: MemberRole): Promise<void> {
  const t = `${PATHS.TEAMS}/${team.teamname}`;
  const updates: Record<string, unknown> = {
    [`${t}/pendingplayers/${uid}`]: null,
    [`${t}/pendingCoaches/${uid}`]: null,
    [`${t}/userplayers/${uid}`]: role === "player" ? true : null,
    [`${t}/coaches/${uid}`]: role === "coach" ? true : null,
    [`${t}/delegates/${uid}`]: role === "delegate" ? true : null,
    [`${PATHS.USER_TEAMS}/${uid}/${team.teamname}`]: true,
  };
  if (!(await hasActiveTeam(uid))) updates[`${PATHS.USERS}/${uid}/teamname`] = team.teamname;
  await update(ref(db), updates);
}
