"use client";

import { get, ref } from "firebase/database";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { canViewExercise } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import type { Exercise } from "@/lib/types";

// Detalle por query param (?name=): las claves de Exercises/{name} son
// nombres libres, incompatibles con rutas dinámicas en output: export.
function ExerciseDetail() {
  const params = useSearchParams();
  const name = params.get("name");
  const { profile } = useAuth();
  const [result, setResult] = useState<
    { name: string; exercise: Exercise | null } | undefined
  >(undefined);

  useEffect(() => {
    if (!name) return;
    void get(ref(db, `${PATHS.EXERCISES}/${name}`)).then(
      (snap) =>
        setResult({
          name,
          exercise: snap.exists()
            ? parseOr(ExerciseSchema, snap.val(), `Exercises/${name}`)
            : null,
        }),
      () => setResult({ name, exercise: null }),
    );
  }, [name]);

  // Derivado: sin ?name no hay nada que cargar; un result de otro name
  // (navegación entre detalles) cuenta como "cargando".
  const exercise = !name
    ? null
    : result?.name === name
      ? result.exercise
      : undefined;

  if (exercise === undefined || profile === null) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (exercise === null || !canViewExercise(profile, exercise)) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">Ejercicio no encontrado.</p>
        <Link href="/exercises" className="underline underline-offset-4">
          Volver a ejercicios
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/exercises"
        className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[#818CF8] underline-offset-4 hover:underline"
      >
        ← Ejercicios
      </Link>
      <h1 className="text-3xl font-bold">{exercise.name}</h1>
      <div className="flex flex-wrap gap-1">
        <PrivacyBadge privacy={exercise.privacy} />
        <ApprovalBadge status={exercise.approvalStatus} />
        {exercise.etiquetas.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
      {exercise.image && (
        // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
        <img
          src={exercise.image}
          alt={exercise.name ?? ""}
          className="w-full rounded-xl object-cover"
        />
      )}
      {exercise.descCorta && (
        <p className="font-medium">{exercise.descCorta}</p>
      )}
      {exercise.descLarga && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {exercise.descLarga}
        </p>
      )}
      {exercise.author && (
        <p className="text-sm text-muted-foreground">Autor: {exercise.author}</p>
      )}
    </article>
  );
}

export default function ExerciseDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ExerciseDetail />
    </Suspense>
  );
}
