"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseMapOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Exercise, Training } from "@/lib/types";

/**
 * Ejercicios/entrenos SIN el filtro de visibilidad de canViewExercise/
 * canViewTraining — se suscribe directamente al nodo RTDB completo, igual
 * que useExercises/useTrainings, pero sin pasar por permissions.ts. Solo
 * para vistas de administración (`/admin/content`, `/admin/metrics`); las
 * páginas normales de /exercises y /trainings siguen usando los hooks con
 * filtro — decisión cerrada: bypass acotado a estas vistas, no global.
 */
export function useAllContent() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [trainings, setTrainings] = useState<Training[] | null>(null);

  useEffect(() => {
    return onValue(
      ref(db, PATHS.EXERCISES),
      (snap) => setExercises(parseMapOr(ExerciseSchema, snap.val(), "Exercises")),
      () => setExercises([]),
    );
  }, []);

  useEffect(() => {
    return onValue(
      ref(db, PATHS.TRAININGS),
      (snap) => setTrainings(parseMapOr(TrainingSchema, snap.val(), "Trainings")),
      () => setTrainings([]),
    );
  }, []);

  return {
    exercises: exercises ?? [],
    trainings: trainings ?? [],
    loading: exercises === null || trainings === null,
  };
}
