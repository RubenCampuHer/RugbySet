"use client";

import { get, ref } from "firebase/database";
import { Download, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { CardActionsMenu } from "@/components/CardActionsMenu";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PrivacyBadge, ApprovalBadge } from "@/components/PrivacyBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailSkeleton } from "@/components/skeletons";
import { CopyToMineDialog } from "@/components/library/CopyToMineDialog";
import { ExerciseExtrasView } from "@/components/exercises/ExerciseExtrasView";
import { LinkifiedText } from "@/components/LinkifiedText";
import { VideoLinkCard } from "@/components/media/VideoLinkCard";
import { useAudienceViewer } from "@/hooks/useAudienceViewer";
import { useExerciseExtras } from "@/hooks/useExerciseExtras";
import { useClub } from "@/hooks/useClub";
import { useMyClubId } from "@/hooks/useMyClubId";
import { copyExerciseToMine, deleteExercise, duplicateExercise } from "@/lib/actions/exercises";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { extractLinks, isVideoSite } from "@/lib/linkify";
import {
  canCreateContent,
  canDeleteExercise,
  canEditExercise,
  canViewExercise,
} from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import type { Exercise } from "@/lib/types";

// Detalle por query param (?name=): las claves de Exercises/{name} son
// nombres libres, incompatibles con rutas dinámicas en output: export.
function ExerciseDetail() {
  const params = useSearchParams();
  const name = params.get("name");
  const router = useRouter();
  const { profile } = useAuth();
  const { clubId: myClubId, loading: loadingMyClub } = useMyClubId();
  const { club: adminClub, loading: loadingAdminClub } = useClub();
  const audienceViewer = useAudienceViewer();
  const extras = useExerciseExtras(name);
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

  if (exercise === undefined || profile === null || loadingMyClub || loadingAdminClub) {
    return <DetailSkeleton />;
  }
  if (
    exercise === null ||
    !canViewExercise(profile, exercise, { myClubId, myAdminClubId: adminClub?.clubId, audienceViewer })
  ) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">Ejercicio no encontrado.</p>
        <Link href="/exercises" className="underline underline-offset-4">
          Volver a ejercicios
        </Link>
      </div>
    );
  }

  // Enlaces de vídeo escritos en el texto ("Referencias: https://…"), sin
  // repetir el vídeo propio del ejercicio.
  const referenceVideos = extractLinks(`${exercise.descCorta ?? ""}\n${exercise.descLarga ?? ""}`).filter(
    (url) => isVideoSite(url) && url !== extras?.video?.url,
  );

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/exercises" label="Ejercicios" />
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-3xl font-bold">{exercise.name}</h1>
        <div className="flex shrink-0 gap-1">
          {exercise.name &&
            (canEditExercise(profile, exercise) || canDeleteExercise(profile, exercise)) && (
              <CardActionsMenu
                editHref={`/exercises/edit?name=${encodeURIComponent(exercise.name)}`}
                onDuplicate={async () => {
                  const newName = await duplicateExercise(exercise, profile);
                  toast.success(`Duplicado como "${newName}"`);
                  router.push(`/exercises/detail?name=${encodeURIComponent(newName)}`);
                }}
                onDelete={async () => {
                  await deleteExercise(exercise, profile);
                  toast.success(`"${exercise.name}" eliminado`);
                  router.replace("/exercises");
                }}
                deleteTitle="¿Eliminar ejercicio?"
                deleteDescription={`Se eliminará "${exercise.name}" permanentemente.`}
              />
            )}
          {exercise.name && <FavoriteButton kind="exercise" name={exercise.name} />}
        </div>
      </div>
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
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export) */}
          <img
            src={exercise.image}
            alt={exercise.name ?? ""}
            className="w-full rounded-xl object-cover"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Descargar imagen"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
            render={
              <a
                href={exercise.image}
                download={`${exercise.name || "ejercicio"}.jpg`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Download />
          </Button>
        </div>
      )}
      {exercise.descCorta && <LinkifiedText text={exercise.descCorta} className="font-medium" />}
      {exercise.descLarga && <LinkifiedText text={exercise.descLarga} className="text-muted-foreground" />}
      {referenceVideos.length > 0 && (
        <section className="space-y-2 print:hidden">
          <h2 className="text-sm font-medium text-muted-foreground">Vídeos de referencia</h2>
          {referenceVideos.map((url) => (
            <VideoLinkCard key={url} url={url} />
          ))}
        </section>
      )}
      {extras && <ExerciseExtrasView extras={extras} />}
      {exercise.name && canEditExercise(profile, exercise) && extras !== undefined && (
        <Button
          variant="outline"
          className="print:hidden"
          render={<Link href={`/exercises/levels?name=${encodeURIComponent(exercise.name)}`} />}
        >
          <Layers /> {extras ? "Editar vídeo y niveles" : "Añadir vídeo o niveles"}
        </Button>
      )}
      {exercise.copiedFrom?.name && (
        <p className="text-sm text-muted-foreground">
          Basado en{" "}
          <Link
            href={`/exercises/detail?name=${encodeURIComponent(exercise.copiedFrom.name)}`}
            className="underline underline-offset-4"
          >
            {exercise.copiedFrom.name}
          </Link>
          {exercise.copiedFrom.author ? `, de ${exercise.copiedFrom.author}` : ""}
        </p>
      )}
      {exercise.author && (
        <p className="text-sm text-muted-foreground">Autor: {exercise.author}</p>
      )}
      {exercise.name && canCreateContent(profile) && exercise.author !== profile.username && (
        <div className="print:hidden">
          <CopyToMineDialog
            kind="exercise"
            sourceName={exercise.name}
            onCopy={async (newName) => {
              const created = await copyExerciseToMine(exercise, newName, profile);
              toast.success(`Copiado como "${created}"`, {
                description: "Es privado: solo lo ves tú hasta que cambies la privacidad.",
              });
              router.push(`/exercises/detail?name=${encodeURIComponent(created)}`);
            }}
          />
        </div>
      )}
    </article>
  );
}

export default function ExerciseDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ExerciseDetail />
    </Suspense>
  );
}
