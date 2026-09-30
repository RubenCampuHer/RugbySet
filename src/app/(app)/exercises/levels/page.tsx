"use client";

import { ArrowDown, ArrowUp, Dumbbell, Layers, Lock, Plus, Trash2 } from "lucide-react";
import { get, ref } from "firebase/database";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";
import { VideoField } from "@/components/exercises/VideoField";
import { LibraryRefCard } from "@/components/lessons/LibraryRefCard";
import { ExercisePickerSheet } from "@/components/trainings/ExercisePickerSheet";
import { DetailSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteUnusedVideos, getExerciseExtras, saveExerciseExtras } from "@/lib/actions/exercise-extras";
import { PATHS } from "@/lib/constants";
import { LEVEL_DESC_MAX, LEVEL_NAME_MAX, type LevelEntry, sortedLevels } from "@/lib/exercise-extras";
import { db } from "@/lib/firebase";
import { canEditExercise } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import type { VideoRef } from "@/lib/schemas/exercise-extras";
import type { Exercise } from "@/lib/types";

let localSeq = 0;
/** Id local de nivel (clave RTDB válida, sin push para no depender de la red). */
const levelId = () => `l${Date.now().toString(36)}${(localSeq++).toString(36)}`;

type Loaded = { name: string; exercise: Exercise | null };

// Vídeo y niveles de un ejercicio (2026-09-29). Aparte de /exercises/edit:
// se guarda en ExerciseExtras/{nombre} y no vuelve a pedir aprobación.
function LevelsEditor() {
  const params = useSearchParams();
  const name = params.get("name");
  const router = useRouter();
  const { profile } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [video, setVideo] = useState<VideoRef | null>(null);
  const [levels, setLevels] = useState<LevelEntry[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickSelection, setPickSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    void Promise.all([get(ref(db, `${PATHS.EXERCISES}/${name}`)), getExerciseExtras(name)]).then(
      ([snap, extras]) => {
        if (cancelled) return;
        const exercise = snap.exists() ? parseOr(ExerciseSchema, snap.val(), `Exercises/${name}`) : null;
        const lv = sortedLevels(extras);
        setLoaded({ name, exercise });
        setVideo(extras?.video ?? null);
        setLevels(lv.length ? lv : [{ id: levelId(), level: { name: "", desc: "", order: 0, video: null } }]);
      },
      () => !cancelled && setLoaded({ name, exercise: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!name) return <EmptyState icon={Layers} title="Ejercicio no encontrado" />;
  if (!loaded || loaded.name !== name || profile === null) return <DetailSkeleton />;
  const exercise = loaded.exercise;
  if (!exercise) return <EmptyState icon={Layers} title="Ejercicio no encontrado" />;
  if (!canEditExercise(profile, exercise)) {
    return <EmptyState icon={Lock} title="No puedes editar este ejercicio" hint="Solo su autor o un administrador." />;
  }

  const detailHref = `/exercises/detail?name=${encodeURIComponent(name)}`;
  const patch = (id: string, p: Partial<LevelEntry["level"]>) =>
    setLevels((l) => l.map((e) => (e.id === id ? { ...e, level: { ...e.level, ...p } } : e)));
  const move = (i: number, dir: -1 | 1) =>
    setLevels((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const onUploaded = (path: string) => setUploaded((u) => [...u, path]);
  const onBusy = (b: boolean) => setBusy((n) => n + (b ? 1 : -1));

  const save = async () => {
    setSaving(true);
    try {
      await saveExerciseExtras(exercise, { video, levels }, uploaded, profile);
      toast.success("Vídeo y niveles guardados");
      router.replace(detailHref);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  };
  const cancel = async () => {
    // Lo subido en esta visita y no guardado (lo de antes sigue en uso).
    await deleteUnusedVideos(uploaded, null, null).catch(() => {});
    router.replace(detailHref);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <BackLink href={detailHref} label={name} />
      <h1 className="text-2xl font-bold">Vídeo y niveles</h1>
      <p className="text-sm text-muted-foreground">
        Los niveles son variantes del ejercicio de menos a más (2v1 → 2v2 → 3v2…). Se ven en la ficha del
        ejercicio y desde los entrenos. En la app de Android todavía no aparecen.
      </p>

      <Card>
        <CardContent className="space-y-2 py-3">
          <Label>Vídeo del ejercicio</Label>
          <VideoField value={video} onChange={setVideo} onUploaded={onUploaded} onBusyChange={onBusy} />
        </CardContent>
      </Card>

      <h2 className="flex items-center gap-2 pt-2 text-lg font-semibold">
        <Layers className="size-5" /> Niveles
      </h2>
      {levels.map(({ id, level }, i) => (
        <Card key={id}>
          <CardContent className="space-y-3 py-3">
            <div className="flex items-center gap-1">
              <span className="flex-1 text-xs font-medium text-muted-foreground">Nivel {i + 1}</span>
              <Button variant="ghost" size="icon-lg" aria-label="Subir nivel" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Bajar nivel"
                disabled={i === levels.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Quitar nivel"
                onClick={() => setLevels((l) => l.filter((e) => e.id !== id))}
              >
                <Trash2 />
              </Button>
            </div>
            {level.ref && (
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <LibraryRefCard kind="exercise" refName={level.ref} showPrivacyHint />
                </div>
                <Button variant="ghost" size="icon-lg" aria-label="Quitar enlace" onClick={() => patch(id, { ref: null })}>
                  <Trash2 />
                </Button>
              </div>
            )}
            <Input
              aria-label={`Nombre del nivel ${i + 1}`}
              placeholder={level.ref ? "Nombre del nivel (si no, el del ejercicio)" : "Nombre corto: 2v1, con oposición…"}
              value={level.name}
              maxLength={LEVEL_NAME_MAX}
              onChange={(e) => patch(id, { name: e.target.value })}
            />
            <Textarea
              aria-label={`Qué cambia en el nivel ${i + 1}`}
              placeholder="Qué cambia respecto al anterior (opcional)"
              value={level.desc ?? ""}
              rows={3}
              maxLength={LEVEL_DESC_MAX}
              onChange={(e) => patch(id, { desc: e.target.value })}
            />
            <VideoField
              value={level.video ?? null}
              onChange={(v) => patch(id, { video: v })}
              onUploaded={onUploaded}
              onBusyChange={onBusy}
            />
          </CardContent>
        </Card>
      ))}
      <Button
        variant="outline"
        size="xl"
        className="w-full"
        onClick={() => setLevels((l) => [...l, { id: levelId(), level: { name: "", desc: "", order: l.length, video: null } }])}
      >
        <Plus /> Añadir nivel
      </Button>
      <Button
        variant="outline"
        size="xl"
        className="w-full"
        onClick={() => {
          setPickSelection(new Set());
          setPicking(true);
        }}
      >
        <Dumbbell /> Enlazar ejercicios de la biblioteca como niveles
      </Button>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-2xl justify-end gap-2">
          <Button variant="outline" size="xl" disabled={saving} onClick={() => void cancel()}>
            Cancelar
          </Button>
          <Button size="xl" disabled={saving || busy > 0} onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
      <ExercisePickerSheet
        open={picking}
        onOpenChange={setPicking}
        selection={pickSelection}
        confirmLabel="Añadir como niveles"
        onToggle={(n) =>
          setPickSelection((prev) => {
            const next = new Set(prev);
            if (next.has(n)) next.delete(n);
            else next.add(n);
            return next;
          })
        }
        onConfirm={() => {
          const refs = [...pickSelection].filter((n) => n !== name);
          setLevels((l) => [
            // El nivel vacío inicial sobra si solo se enlaza.
            ...l.filter((e) => e.level.name.trim() || e.level.desc?.trim() || e.level.ref || e.level.video),
            ...refs.map((ref) => ({ id: levelId(), level: { name: "", desc: "", order: 0, ref, video: null } })),
          ]);
          setPicking(false);
        }}
      />
    </div>
  );
}

export default function ExerciseLevelsPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <LevelsEditor />
    </Suspense>
  );
}
