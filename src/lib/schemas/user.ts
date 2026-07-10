// Fuente: _User.kt y _Notification.kt del repo Android — mantener en sincronía.
import { z } from "zod";
import { RoleSchema, rtdbList, timestampMs } from "./common";

// Perfil PROPIO (Users/{uid}). Sin fcmToken: la web no lo consume.
export const UserSchema = z.object({
  userId: z.string().nullish(),
  username: z.string().nullish(),
  nameSurname: z.string().nullish(),
  teamname: z.string().nullish(),
  mail: z.string().nullish(),
  usericon: z.string().nullish(),
  assistedTrainingDays: rtdbList(z.string()).default([]),
  favExercises: rtdbList(z.string()).default([]),
  favTrainings: rtdbList(z.string()).default([]),
  role: RoleSchema,
});

// publicProfiles/{uid} — proyección pública mantenida por la Cloud Function
// mirrorPublicProfile (sin mail, sin fcmToken, sin favoritos).
export const PublicProfileSchema = z.object({
  userId: z.string().nullish(),
  username: z.string().nullish(),
  nameSurname: z.string().nullish(),
  usericon: z.string().nullish(),
  teamname: z.string().nullish(),
  role: RoleSchema,
});

export const NotificationSchema = z.object({
  id: z.string(),
  type: z.enum(["attendance", "reminder", "general", "training_update"]).catch("general"),
  title: z.string().catch(""),
  message: z.string().catch(""),
  teamName: z.string().nullish(),
  trainingDate: z.string().nullish(),
  trainingTime: z.string().nullish(),
  senderUserId: z.string().nullish(),
  senderUsername: z.string().nullish(),
  timestamp: timestampMs.catch(0),
  read: z.boolean().catch(false),
  recipientUserId: z.string().nullish(),
});
