// Acciones de ADMIN — las reglas RTDB validan el rol del caller en servidor
// (role .write ADMIN; approvalStatus .write ADMIN).
import { ref, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";

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
