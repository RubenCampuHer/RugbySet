"use client";

import { get, ref } from "firebase/database";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { DetailSkeleton } from "@/components/skeletons";
import { TagInput } from "@/components/TagInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExercisePickerSheet } from "@/components/trainings/ExercisePickerSheet";
import { createTraining, updateTraining } from "@/lib/actions/trainings";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { useExercises } from "@/hooks/useExercises";
import { canCreateContent, canEditTraining } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { TrainingSchema } from "@/lib/schemas/training";
import type { Section, Training, User } from "@/lib/types";

const NAME_MIN = 3;
const NAME_MAX = 50;
const DESC_CORTA_MIN = 10;
const DESC_CORTA_MAX = 200;

function newSectionId() {
  return crypto.randomUUID();
}

/** Recalcula `order` y `tiempoSeccion` tras cualquier cambio en los ejercicios. */
function recalc(section: Section): Section {
  const exercises = section.exercises.map((et, i) => ({ ...et, order: i }));
  const tiempoSeccion = exercises.reduce((sum, et) => sum + (et.tiempoExercise ?? 0), 0);
  return { ...section, exercises, tiempoSeccion };
}

// Formulario propiamente dicho — key={originalName} en el padre inicializa
// el estado directamente desde props (sin efecto de sincronización).
function TrainingForm({
  original,
  originalName,
  profile,
}: {
  original: Training | null;
  originalName: string | null;
  profile: User;
}) {
  const router = useRouter();
  const isEdit = originalName !== null;
  const { exercises: visibleExercises } = useExercises();

  const [name, setName] = useState(original?.name ?? "");
  const [descCorta, setDescCorta] = useState(original?.descCorta ?? "");
  const [privacy, setPrivacy] = useState<"Publico" | "Privado">(
    original?.privacy === "Privado" ? "Privado" : "Publico",
  );
  const [etiquetas, setEtiquetas] = useState<string[]>(original?.etiquetas ?? []);
  const [sections, setSections] = useState<Section[]>(
    (original?.sections ?? []).map((s) => ({ ...s, uid: s.uid ?? newSectionId() })),
  );
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerSelection, setPickerSelection] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const isNameValid = name.length >= NAME_MIN && name.length <= NAME_MAX;
  const isDescCortaValid =
    descCorta.length >= DESC_CORTA_MIN && descCorta.length <= DESC_CORTA_MAX;
  const hasExercises = sections.some((s) => s.exercises.length > 0);
  const canSave = isNameValid && isDescCortaValid && hasExercises && !saving;
  const tiempoTotal = sections.reduce((sum, s) => sum + s.tiempoSeccion, 0);

  const updateSection = (uid: string, fn: (s: Section) => Section) =>
    setSections((prev) => prev.map((s) => (s.uid === uid ? fn(s) : s)));

  const addSection = () =>
    setSections((prev) => [
      ...prev,
      { sectionName: "", tiempoSeccion: 0, exercises: [], uid: newSectionId() },
    ]);

  const removeSection = (uid: string) =>
    setSections((prev) => prev.filter((s) => s.uid !== uid));

  const openPicker = (section: Section) => {
    setPickerSelection(
      new Set(
        section.exercises
          .map((et) => et.exercise?.name)
          .filter((n): n is string => !!n),
      ),
    );
    setPickerFor(section.uid ?? null);
  };

  const togglePickerSelection = (exerciseName: string) =>
    setPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseName)) next.delete(exerciseName);
      else next.add(exerciseName);
      return next;
    });

  // Reemplaza la lista de la sección por la selección completa, conservando
  // el tiempo de los ejercicios ya presentes — espejo de
  // AddTraining.updateExercisesList (el picker no "añade", sustituye).
  const confirmPicker = () => {
    if (!pickerFor) return;
    updateSection(pickerFor, (s) =>
      recalc({
        ...s,
        exercises: visibleExercises
          .filter((e) => e.name && pickerSelection.has(e.name))
          .map((e) => s.exercises.find((et) => et.exercise?.name === e.name) ?? {
            exercise: e,
            tiempoExercise: 0,
            order: 0,
          }),
      }),
    );
    setPickerFor(null);
  };

  const removeExercise = (sectionUid: string, exerciseName: string | null | undefined) =>
    updateSection(sectionUid, (s) =>
      recalc({ ...s, exercises: s.exercises.filter((et) => et.exercise?.name !== exerciseName) }),
    );

  const setExerciseTime = (sectionUid: string, index: number, minutes: number) =>
    updateSection(sectionUid, (s) =>
      recalc({
        ...s,
        exercises: s.exercises.map((et, i) => (i === index ? { ...et, tiempoExercise: minutes } : et)),
      }),
    );

  const moveExercise = (sectionUid: string, index: number, dir: -1 | 1) =>
    updateSection(sectionUid, (s) => {
      const target = index + dir;
      if (target < 0 || target >= s.exercises.length) return s;
      const exercises = [...s.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return recalc({ ...s, exercises });
    });

  const save = async () => {
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        descCorta: descCorta.trim(),
        sections,
        privacy,
        etiquetas,
      };
      if (isEdit) {
        await updateTraining(originalName, input, profile);
      } else {
        await createTraining(input, profile);
      }
      toast.success(
        privacy === "Publico"
          ? `Entreno ${isEdit ? "modificado" : "guardado"} y enviado a revisión`
          : `Entreno ${isEdit ? "modificado" : "guardado"} correctamente`,
      );
      router.replace(`/trainings/detail?name=${encodeURIComponent(input.name)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el entreno");
    } finally {
      setSaving(false);
    }
  };

  const pickerSection = sections.find((s) => s.uid === pickerFor) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink
        href={isEdit ? `/trainings/detail?name=${encodeURIComponent(originalName)}` : "/trainings"}
        label={isEdit ? "Entreno" : "Entrenos"}
      />
      <h1 className="text-2xl font-bold">{isEdit ? "Editar entreno" : "Nuevo entreno"}</h1>

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={name.length > 0 && !isNameValid}
        />
        <p className="text-xs text-muted-foreground">
          {name.length}/{NAME_MAX} caracteres (mínimo {NAME_MIN})
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descCorta">Descripción</Label>
        <Input
          id="descCorta"
          value={descCorta}
          onChange={(e) => setDescCorta(e.target.value)}
          aria-invalid={descCorta.length > 0 && !isDescCortaValid}
        />
        <p className="text-xs text-muted-foreground">
          {descCorta.length}/{DESC_CORTA_MAX} caracteres (mínimo {DESC_CORTA_MIN})
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Privacidad</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={privacy === "Publico" ? "default" : "outline"}
            onClick={() => setPrivacy("Publico")}
          >
            Público
          </Button>
          <Button
            type="button"
            variant={privacy === "Privado" ? "default" : "outline"}
            onClick={() => setPrivacy("Privado")}
          >
            Privado
          </Button>
        </div>
      </div>

      <TagInput value={etiquetas} onChange={setEtiquetas} />

      <div className="flex items-center justify-between">
        <Label>Secciones</Label>
        <Badge variant="secondary">Tiempo total: {tiempoTotal} min</Badge>
      </div>

      {sections.map((section, sIndex) => (
        <Card key={section.uid}>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Input
              value={section.sectionName}
              onChange={(e) =>
                updateSection(section.uid!, (s) => ({ ...s, sectionName: e.target.value }))
              }
              placeholder={`Nombre de la sección ${sIndex + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              onClick={() => removeSection(section.uid!)}
              aria-label="Eliminar sección"
            >
              <Trash2 className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.exercises.map((et, eIndex) => (
              <div
                key={et.exercise?.name ?? eIndex}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {et.exercise?.name ?? "(ejercicio)"}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={et.tiempoExercise}
                  onChange={(e) =>
                    setExerciseTime(section.uid!, eIndex, Number(e.target.value) || 0)
                  }
                  className="w-16 text-center"
                  aria-label="Minutos"
                />
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={eIndex === 0}
                    onClick={() => moveExercise(section.uid!, eIndex, -1)}
                    aria-label="Subir"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={eIndex === section.exercises.length - 1}
                    onClick={() => moveExercise(section.uid!, eIndex, 1)}
                    aria-label="Bajar"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeExercise(section.uid!, et.exercise?.name)}
                    aria-label="Quitar ejercicio"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {section.exercises.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin ejercicios.</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={section.sectionName.trim() === ""}
              onClick={() => openPicker(section)}
            >
              <Plus className="size-4" />
              Añadir ejercicios
            </Button>
            {section.sectionName.trim() === "" && (
              <p className="text-xs text-muted-foreground">
                Ponle nombre a la sección antes de añadir ejercicios.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" className="w-full" onClick={addSection}>
        <Plus className="size-4" />
        Añadir sección
      </Button>

      <Button className="w-full" size="xl" disabled={!canSave} onClick={() => void save()}>
        {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear entreno"}
      </Button>

      {pickerSection && (
        <ExercisePickerSheet
          open
          onOpenChange={(open) => !open && setPickerFor(null)}
          selection={pickerSelection}
          onToggle={togglePickerSelection}
          onConfirm={confirmPicker}
        />
      )}
    </div>
  );
}

function TrainingEdit() {
  const params = useSearchParams();
  const originalName = params.get("name");
  const { profile } = useAuth();

  const [original, setOriginal] = useState<Training | null | undefined>(
    originalName ? undefined : null,
  );

  useEffect(() => {
    if (!originalName) return;
    void get(ref(db, `${PATHS.TRAININGS}/${originalName}`)).then(
      (snap) =>
        setOriginal(
          snap.exists()
            ? parseOr(TrainingSchema, snap.val(), `Trainings/${originalName}`)
            : null,
        ),
      () => setOriginal(null),
    );
  }, [originalName]);

  if (profile === null || original === undefined) {
    return <DetailSkeleton />;
  }

  const allowed = originalName
    ? original !== null && canEditTraining(profile, original)
    : canCreateContent(profile);

  if (!allowed) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">
          {originalName
            ? "Este entreno no existe o no tienes permiso para editarlo."
            : "No tienes permiso para crear entrenos."}
        </p>
        <BackLink href="/trainings" label="Entrenos" />
      </div>
    );
  }

  return (
    <TrainingForm
      key={originalName ?? "new"}
      original={original}
      originalName={originalName}
      profile={profile}
    />
  );
}

export default function TrainingEditPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <TrainingEdit />
    </Suspense>
  );
}
