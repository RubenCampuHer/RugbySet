// Convocatoria push — espejo de NotificationManager.sendAttendanceNotification:
// guarda el historial en Users/{uid}/notifications (coach/ADMIN pueden escribir
// en nodo ajeno) y dispara la callable sendPushNotification (us-central1),
// que valida el rol en servidor y envía FCM.
import { ref, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { PATHS } from "@/lib/constants";
import { db, functions } from "@/lib/firebase";

export async function sendAttendanceNotification(opts: {
  teamName: string;
  trainingDate: string;
  trainingTime: string;
  recipientUserIds: string[];
  senderUserId: string;
  senderUsername: string;
}) {
  const { teamName, trainingDate, trainingTime, recipientUserIds, senderUserId, senderUsername } = opts;
  if (recipientUserIds.length === 0) return { sent: 0 };

  const notificationId = crypto.randomUUID();
  const title = `Convocatoria: ${teamName}`;
  const message = `Entrenamiento el ${trainingDate} a las ${trainingTime}. Entra a RugbySet y confirma tu asistencia`;

  // Historial por destinatario (mismo shape que _Notification.kt)
  const updates: Record<string, unknown> = {};
  for (const uid of recipientUserIds) {
    updates[`${PATHS.USERS}/${uid}/${PATHS.NOTIFICATIONS}/${notificationId}`] = {
      id: notificationId,
      type: "attendance",
      title,
      message,
      teamName,
      trainingDate,
      trainingTime,
      senderUserId,
      senderUsername,
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
    type: "attendance",
    notificationId,
    teamName,
    trainingDate,
    trainingTime,
    senderUserId,
    senderUsername,
  });
  const data = result.data as { sentCount?: number };
  return { sent: data.sentCount ?? 0 };
}

/**
 * Aviso general del coach al equipo — espejo de
 * NotificationManager.sendGeneralMessage (mismo patrón de historial +
 * callable que sendAttendanceNotification, tipo "general" en vez de
 * "attendance", sin trainingDate/trainingTime).
 */
export async function sendGeneralMessage(opts: {
  teamName: string;
  message: string;
  recipientUserIds: string[];
  senderUserId: string;
  senderUsername: string;
}) {
  const { teamName, message, recipientUserIds, senderUserId, senderUsername } = opts;
  if (recipientUserIds.length === 0) return { sent: 0 };

  const notificationId = crypto.randomUUID();
  const title = `Mensaje de ${senderUsername} - ${teamName}`;

  const updates: Record<string, unknown> = {};
  for (const uid of recipientUserIds) {
    updates[`${PATHS.USERS}/${uid}/${PATHS.NOTIFICATIONS}/${notificationId}`] = {
      id: notificationId,
      type: "general",
      title,
      message,
      teamName,
      senderUserId,
      senderUsername,
      timestamp: Date.now(),
      read: false,
      recipientUserId: uid,
    };
  }
  await update(ref(db), updates);

  const result = await httpsCallable(functions, "sendPushNotification")({
    recipientUserIds,
    title,
    message,
    type: "general",
    notificationId,
    teamName,
    senderUserId,
    senderUsername,
  });
  const data = result.data as { sentCount?: number };
  return { sent: data.sentCount ?? 0 };
}
