"use client";

import { ClipboardList, Dumbbell, Lock } from "lucide-react";
import { get, ref } from "firebase/database";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAudienceViewer } from "@/hooks/useAudienceViewer";
import { useClub } from "@/hooks/useClub";
import { useMyClubId } from "@/hooks/useMyClubId";
import { gradientFor } from "@/lib/brand";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { canViewExercise, canViewTraining } from "@/lib/permissions";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Exercise, Training } from "@/lib/types";
import { cn } from "@/lib/utils";

type Loaded =
  | { kind: "exercise"; ref: string; item: Exercise | null }
  | { kind: "training"; ref: string; item: Training | null };

/**
 * Ejercicio o entreno de la biblioteca dentro de una lección (2026-09-28).
 * Se lee al mostrarlo (puede haber cambiado o desaparecido) y solo se enseña
 * si quien mira puede verlo con la privacidad de siempre (canView*); si no,
 * "No disponible". `showPrivacyHint` avisa al autor en el editor.
 */
export function LibraryRefCard({
  kind,
  refName,
  showPrivacyHint = false,
}: {
  kind: "exercise" | "training";
  refName: string;
  showPrivacyHint?: boolean;
}) {
  const { profile } = useAuth();
  const { clubId: myClubId } = useMyClubId();
  const { club: adminClub } = useClub();
  const audienceViewer = useAudienceViewer();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    const path = `${kind === "exercise" ? PATHS.EXERCISES : PATHS.TRAININGS}/${refName}`;
    get(ref(db, path))
      .then((snap) => {
        if (!alive) return;
        const raw = snap.exists() ? snap.val() : null;
        if (kind === "exercise") {
          const parsed = raw ? ExerciseSchema.safeParse(raw) : null;
          setLoaded({ kind, ref: refName, item: parsed?.success ? parsed.data : null });
        } else {
          const parsed = raw ? TrainingSchema.safeParse(raw) : null;
          setLoaded({ kind, ref: refName, item: parsed?.success ? parsed.data : null });
        }
      })
      .catch(() => alive && setLoaded({ kind, ref: refName, item: null } as Loaded));
    return () => {
      alive = false;
    };
  }, [kind, refName]);

  const Icon = kind === "exercise" ? Dumbbell : ClipboardList;
  const label = kind === "exercise" ? "Ejercicio" : "Entreno";
  const current = loaded && loaded.kind === kind && loaded.ref === refName ? loaded : null;

  if (!current) {
    return <div className="h-20 animate-pulse rounded-lg bg-muted" aria-label={`Cargando ${label.toLowerCase()}`} />;
  }

  const ctx = { myClubId, myAdminClubId: adminClub?.clubId, audienceViewer };
  const visible =
    current.item != null &&
    (current.kind === "exercise"
      ? canViewExercise(profile, current.item, ctx)
      : canViewTraining(profile, current.item, ctx));

  if (!current.item || !visible) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        <span className="min-w-0">
          {label} «{refName}» {current.item ? "no disponible para ti." : "ya no existe en la biblioteca."}
        </span>
      </div>
    );
  }

  const item = current.item;
  const name = item.name ?? refName;
  const href = `/${kind === "exercise" ? "exercises" : "trainings"}/detail?name=${encodeURIComponent(name)}`;
  const image = current.kind === "exercise" ? current.item.image : null;
  const meta =
    current.kind === "training"
      ? `${current.item.tiempoTotal ?? "?"} min · ${current.item.sections.reduce((n, s) => n + s.exercises.length, 0)} ejercicios`
      : label;

  return (
    <div className="space-y-1">
      <Link href={href} className="flex min-w-0 items-center gap-3 rounded-lg border p-2 hover:bg-muted/50">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de Storage con token, sin optimizador (output: export)
          <img src={image} alt="" className="size-16 shrink-0 rounded-md object-cover" loading="lazy" />
        ) : (
          <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-md bg-gradient-to-br", gradientFor(name))}>
            <Icon className="size-6 text-white/60" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          {item.descCorta && <span className="line-clamp-2 text-xs text-muted-foreground">{item.descCorta}</span>}
          <span className="block text-xs text-muted-foreground">{meta}</span>
        </span>
      </Link>
      {showPrivacyHint && item.privacy === "Privado" && (
        <p className="text-xs text-warning">Es privado: el resto del club no podrá verlo en la lección.</p>
      )}
      {showPrivacyHint && item.privacy !== "Privado" && item.approvalStatus === "PENDING" && (
        <p className="text-xs text-muted-foreground">Pendiente de aprobación: hasta entonces no lo verá todo el mundo.</p>
      )}
    </div>
  );
}
