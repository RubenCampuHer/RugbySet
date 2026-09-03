// Único punto de import de tipos de dominio. Los tipos salen de los schemas
// Zod (fuente de verdad) — no duplicar interfaces a mano.
import type { z } from "zod";
import type { ClubSchema } from "../schemas/club";
import type { ExerciseSchema } from "../schemas/exercise";
import type { LineupDocSchema } from "../schemas/lineup";
import type { TeamSchema, TrainingDaySchema } from "../schemas/team";
import type { ExerciseTrainingSchema, SectionSchema, TrainingSchema } from "../schemas/training";
import type { NotificationSchema, PublicProfileSchema, UserSchema } from "../schemas/user";

export type User = z.infer<typeof UserSchema>;
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Training = z.infer<typeof TrainingSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type ExerciseTraining = z.infer<typeof ExerciseTrainingSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type TrainingDay = z.infer<typeof TrainingDaySchema>;
export type LineupDoc = z.infer<typeof LineupDocSchema>;
export type Club = z.infer<typeof ClubSchema>;

export type Role = "ADMIN" | "COACH" | "PLAYER";
