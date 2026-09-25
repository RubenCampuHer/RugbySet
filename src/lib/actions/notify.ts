// Convocatoria push — espejo de NotificationManager.sendAttendanceNotification:
// guarda el historial en Users/{uid}/notifications (coach/ADMIN pueden escribir
// en nodo ajeno) y dispara la callable sendPushNotification (us-central1),
// que valida el rol en servidor y envía FCM.
import { ref, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { PATHS } from "@/lib/constants";
import { db, functions } from "@/lib/firebase";
import type { Notification } from "@/lib/types";

type Sender = { senderUserId: string; senderUsername: string };

/**
 * Historial por destinatario (mismo shape que _Notification.kt) + push FCM.
 * Devuelve cuántos dispositivos lo recibieron (el resto lo verá en su bandeja).
 */
async function notifyUsers(
  opts: Sender & {
    type: Notification["type"];
    title: string;
    message: string;
    teamName: string;
    trainingDate?: string;
    trainingTime?: string;
    recipientUserIds: string[];
  },
): Promise<{ sent: number }> {
  const { recipientUserIds, type, title, message, teamName, trainingDate, trainingTime } = opts;
  if (recipientUserIds.length === 0) return { sent: 0 };

  const notificationId = crypto.randomUUID();
  const extra = {
    ...(trainingDate ? { trainingDate } : {}),
    ...(trainingTime ? { trainingTime } : {}),
  };
  const updates: Record<string, unknown> = {};
  for (const uid of recipientUserIds) {
    updates[`${PATHS.USERS}/${uid}/${PATHS.NOTIFICATIONS}/${notificationId}`] = {
      id: notificationId,
      type,
      title,
      message,
      teamName,
      ...extra,
      senderUserId: opts.senderUserId,
      senderUsername: opts.senderUsername,
      timestamp: Date.now(),
      read: false,
      recipientUserId: uid,
    };
  }
  await update(ref(db), updates);

  // Push FCM vía Cloud Function (devuelve {success, sentCount, failedCount})
  const result = await httpsCallable(functions, "sendPushNotification")({
    recipientUserIds,
    title,
    message,
    type,
    notificationId,
    teamName,
    ...extra,
    senderUserId: opts.senderUserId,
    senderUsername: opts.senderUsername,
  });
  const data = result.data as { sentCount?: number };
  return { sent: data.sentCount ?? 0 };
}

export async function sendAttendanceNotification(
  opts: Sender & {
    teamName: string;
    trainingDate: string;
    trainingTime: string;
    recipientUserIds: string[];
    /** Partido en vez de entrenamiento (solo cambia el texto). */
    isMatch?: boolean;
  },
) {
  const what = opts.isMatch ? "Partido" : "Entrenamiento";
  return notifyUsers({
    ...opts,
    type: "attendance",
    title: `Convocatoria: ${opts.teamName}`,
    message: `${what} el ${opts.trainingDate} a las ${opts.trainingTime}. Entra a RugbySet y confirma tu asistencia`,
  });
}

/**
 * Aviso general del coach al equipo — espejo de
 * NotificationManager.sendGeneralMessage (tipo "general", sin fecha).
 */
export async function sendGeneralMessage(
  opts: Sender & { teamName: string; message: string; recipientUserIds: string[] },
) {
  return notifyUsers({
    ...opts,
    type: "general",
    title: `Mensaje de ${opts.senderUsername} - ${opts.teamName}`,
  });
}

/**
 * Aviso de cambio en un evento (2026-09-23): hora/lugar cambiados, cancelado
 * o reactivado. Tipo "training_update" — ya existía en el enum y la bandeja
 * lo abre en el día del calendario.
 */
export async function sendEventChangeNotification(
  opts: Sender & {
    teamName: string;
    trainingDate: string;
    trainingTime: string;
    recipientUserIds: string[];
    change: "updated" | "cancelled" | "reactivated";
    isMatch?: boolean;
    location?: string | null;
  },
) {
  const what = opts.isMatch ? "El partido" : "El entreno";
  const where = opts.location ? ` en ${opts.location}` : "";
  const message =
    opts.change === "cancelled"
      ? `${what} del ${opts.trainingDate} queda cancelado.`
      : opts.change === "reactivated"
        ? `${what} del ${opts.trainingDate} vuelve a estar en pie: ${opts.trainingTime}${where}.`
        : `${what} del ${opts.trainingDate} ha cambiado: ${opts.trainingTime}${where}.`;
  return notifyUsers({
    ...opts,
    type: "training_update",
    title: `${opts.change === "cancelled" ? "Cancelado" : "Cambio"}: ${opts.teamName}`,
    message,
  });
}

/**
 * Resultado del partido (2026-09-25): aviso opcional al equipo al guardarlo.
 * Tipo "training_update" para que la bandeja abra el día del calendario.
 */
export async function sendMatchResultNotification(
  opts: Sender & {
    teamName: string;
    trainingDate: string;
    recipientUserIds: string[];
    /** p. ej. "Victoria 24 – 10 contra Leones RC". */
    summary: string;
  },
) {
  return notifyUsers({
    ...opts,
    type: "training_update",
    title: `Resultado: ${opts.teamName}`,
    message: `${opts.summary}. Mira el partido en RugbySet.`,
  });
}
