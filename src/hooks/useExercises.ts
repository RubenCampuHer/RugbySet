"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClub } from "@/hooks/useClub";
import { useMyClubId } from "@/hooks/useMyClubId";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { canViewExercise } from "@/lib/permissions";
import { parseMapOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import type { Exercise } from "@/lib/types";

/**
 * Ejercicios visibles para el usuario actual, en tiempo real.
 * El filtrado de privacidad se hace en cliente con canViewExercise —
 * exactamente igual que Android (ExerciseRepository.observeExercises).
 * myClubId/myAdminClubId alimentan el caso "Club" (visible al club, con
 * aprobación del admin del club).
 */
export function useExercises() {
  const { profile } = useAuth();
  const { clubId: myClubId, loading: loadingMyClub } = useMyClubId();
  const { club: adminClub, loading: loadingAdminClub } = useClub();
  const [all, setAll] = useState<Exercise[] | null>(null);

  useEffect(() => {
    const exercisesRef = ref(db, PATHS.EXERCISES);
    return onValue(
      exercisesRef,
      (snap) => setAll(parseMapOr(ExerciseSchema, snap.val(), "Exercises")),
      (error) => {
        console.error("useExercises:", error);
        setAll([]);
      },
    );
  }, []);

  const loading = all === null || profile === null || loadingMyClub || loadingAdminClub;
  const exercises = loading
    ? []
    : all.filter((e) => canViewExercise(profile, e, { myClubId, myAdminClubId: adminClub?.clubId }));

  return { exercises, loading };
}
