"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { PATHS } from "@/lib/constants";
import { levelCount } from "@/lib/exercise-extras";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { type ExerciseExtras, ExerciseExtrasSchema } from "@/lib/schemas/exercise-extras";

/**
 * Vídeo y niveles de un ejercicio en tiempo real (2026-09-29).
 * undefined = cargando, null = no tiene.
 */
export function useExerciseExtras(name: string | null | undefined): ExerciseExtras | null | undefined {
  const [state, setState] = useState<{ name: string; extras: ExerciseExtras | null } | null>(null);
  useEffect(() => {
    if (!name) return;
    return onValue(
      ref(db, `${PATHS.EXERCISE_EXTRAS}/${name}`),
      (snap) =>
        setState({
          name,
          extras: snap.exists() ? parseOr(ExerciseExtrasSchema, snap.val(), `ExerciseExtras/${name}`) : null,
        }),
      () => setState({ name, extras: null }),
    );
  }, [name]);
  if (!name) return null;
  return state?.name === name ? state.extras : undefined;
}

export type ExtrasSummary = { levels: number; video: boolean };

/** Resumen de todos los ejercicios con extras (para marcarlos en listas y entrenos). */
export function useExtrasSummary(): Record<string, ExtrasSummary> {
  const [summary, setSummary] = useState<Record<string, ExtrasSummary>>({});
  useEffect(
    () =>
      onValue(
        ref(db, PATHS.EXERCISE_EXTRAS),
        (snap) => {
          const raw = (snap.val() ?? {}) as Record<string, unknown>;
          const out: Record<string, ExtrasSummary> = {};
          for (const [name, v] of Object.entries(raw)) {
            const x = parseOr(ExerciseExtrasSchema, v, `ExerciseExtras/${name}`);
            if (x) out[name] = { levels: levelCount(x), video: Boolean(x.video) };
          }
          setSummary(out);
        },
        () => setSummary({}),
      ),
    [],
  );
  return summary;
}
