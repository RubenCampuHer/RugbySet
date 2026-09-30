// El entreno de un día del calendario tal como está guardado en ese día
// (2026-09-30). Cada Teams/{t}/trainingdays[i] lleva una COPIA completa del
// entreno, así que los jugadores lo ven aunque el de la biblioteca sea privado
// del entrenador o se haya editado después.
import type { Exercise, Team, Training, TrainingDay } from "@/lib/types";

export function dayTraining(team: Team | null | undefined, fecha: string | null): { day: TrainingDay; training: Training } | null {
  if (!team || !fecha) return null;
  const day = team.trainingdays.find((d) => d.fecha === fecha);
  return day?.training ? { day, training: day.training } : null;
}

/** Copia del ejercicio dentro del entreno de ese día (por nombre). */
export function dayExercise(team: Team | null | undefined, fecha: string | null, name: string | null): Exercise | null {
  if (!name) return null;
  const found = dayTraining(team, fecha);
  if (!found) return null;
  for (const section of found.training.sections) {
    for (const et of section.exercises) {
      if (et.exercise?.name === name) return et.exercise;
    }
  }
  return null;
}

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

/** Ficha del entreno de un día del calendario. */
export const dayTrainingHref = (teamname: string, fecha: string) => `/trainings/detail?${q({ team: teamname, fecha })}`;

/** Ficha de un ejercicio abierto desde el entreno de un día (con copia de respaldo). */
export const dayExerciseHref = (teamname: string, fecha: string, name: string) =>
  `/exercises/detail?${q({ name, team: teamname, fecha })}`;
