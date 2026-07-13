"use client";

import { get, ref } from "firebase/database";
import { ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { canViewTraining } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Training } from "@/lib/types";

function TrainingDetail() {
  const params = useSearchParams();
  const name = params.get("name");
  const { profile } = useAuth();
  const [result, setResult] = useState<
    { name: string; training: Training | null } | undefined
  >(undefined);

  useEffect(() => {
    if (!name) return;
    void get(ref(db, `${PATHS.TRAININGS}/${name}`)).then(
      (snap) =>
        setResult({
          name,
          training: snap.exists()
            ? parseOr(TrainingSchema, snap.val(), `Trainings/${name}`)
            : null,
        }),
      () => setResult({ name, training: null }),
    );
  }, [name]);

  const training = !name
    ? null
    : result?.name === name
      ? result.training
      : undefined;

  if (training === undefined || profile === null) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (training === null || !canViewTraining(profile, training)) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">Entreno no encontrado.</p>
        <Link href="/trainings" className="underline underline-offset-4">
          Volver a entrenos
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/trainings" label="Entrenos" />
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-3xl font-bold">{training.name}</h1>
        {training.name && <FavoriteButton kind="training" name={training.name} />}
      </div>
      <div className="flex flex-wrap gap-1">
        <PrivacyBadge privacy={training.privacy} />
        <ApprovalBadge status={training.approvalStatus} />
        <Badge variant="secondary" className="gap-1">
          <Clock className="size-3" /> {training.tiempoTotal ?? "?"} min
        </Badge>
        {training.etiquetas.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
      {training.descCorta && <p>{training.descCorta}</p>}

      {training.sections.map((section, i) => (
        <Card key={section.uid ?? i}>
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between text-lg">
              <span>{section.sectionName || `Sección ${i + 1}`}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {section.tiempoSeccion} min
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* El ejercicio viene EMBEBIDO (copia completa) — sin fetch extra */}
            {[...section.exercises]
              .sort((a, b) => a.order - b.order)
              .map((et, j) => {
                const name = et.exercise?.name;
                const row = (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{name ?? "(ejercicio)"}</p>
                      {et.exercise?.descCorta && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {et.exercise.descCorta}
                        </p>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline">{et.tiempoExercise} min</Badge>
                      {name && <ChevronRight className="size-4 text-muted-foreground" />}
                    </span>
                  </div>
                );
                return (
                  <div key={j}>
                    {j > 0 && <Separator className="mb-3" />}
                    {name ? (
                      <Link
                        href={`/exercises/detail?name=${encodeURIComponent(name)}`}
                        className="-m-2 block rounded-lg p-2 transition-colors hover:bg-muted/50 active:bg-muted"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </div>
                );
              })}
            {section.exercises.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin ejercicios.</p>
            )}
          </CardContent>
        </Card>
      ))}

      {training.author && (
        <p className="text-sm text-muted-foreground">Autor: {training.author}</p>
      )}
    </article>
  );
}

export default function TrainingDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TrainingDetail />
    </Suspense>
  );
}
