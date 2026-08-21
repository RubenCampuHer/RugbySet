"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClub } from "@/hooks/useClub";
import { useMyClubId } from "@/hooks/useMyClubId";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { canViewTraining } from "@/lib/permissions";
import { parseMapOr } from "@/lib/schemas/common";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Training } from "@/lib/types";

/**
 * Entrenamientos visibles para el usuario actual, en tiempo real.
 * Mismo patrón que useExercises: filtrado en cliente con canViewTraining,
 * igual que Android (TrainingRepository.observeTrainings).
 */
export function useTrainings() {
  const { profile } = useAuth();
  const { clubId: myClubId, loading: loadingMyClub } = useMyClubId();
  const { club: adminClub, loading: loadingAdminClub } = useClub();
  const [all, setAll] = useState<Training[] | null>(null);

  useEffect(() => {
    const trainingsRef = ref(db, PATHS.TRAININGS);
    return onValue(
      trainingsRef,
      (snap) => setAll(parseMapOr(TrainingSchema, snap.val(), "Trainings")),
      (error) => {
        console.error("useTrainings:", error);
        setAll([]);
      },
    );
  }, []);

  const loading = all === null || profile === null || loadingMyClub || loadingAdminClub;
  const trainings = loading
    ? []
    : all.filter((t) => canViewTraining(profile, t, { myClubId, myAdminClubId: adminClub?.clubId }));

  return { trainings, loading };
}
