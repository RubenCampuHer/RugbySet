// Toggle de favoritos — escritura por hijo sobre el nodo PROPIO
// (espejo de _User.addRemoveFavExercise/addRemoveFavTraining).
import { get, ref, update } from "firebase/database";
import { PATHS } from "@/lib/constants";
import { auth, db } from "@/lib/firebase";

export async function toggleFavorite(
  kind: "exercise" | "training",
  name: string,
): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No autenticado");
  const field = kind === "exercise" ? "favExercises" : "favTrainings";
  const snap = await get(ref(db, `${PATHS.USERS}/${uid}/${field}`));
  const v = snap.val();
  const list = (
    v == null ? [] : Array.isArray(v) ? v : Object.values(v)
  ).filter(Boolean) as string[];
  const inserted = !list.includes(name);
  const next = inserted ? [...list, name] : list.filter((n) => n !== name);
  await update(ref(db, `${PATHS.USERS}/${uid}`), { [field]: next });
  return inserted;
}
