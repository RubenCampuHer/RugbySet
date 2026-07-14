"use client";

import { get, ref } from "firebase/database";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/BackLink";
import { ImageUploadInput } from "@/components/exercises/ImageUploadInput";
import { DetailSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createExercise, updateExercise, uploadExerciseImage } from "@/lib/actions/exercises";
import { PATHS } from "@/lib/constants";
import { auth, db } from "@/lib/firebase";
import { canCreateContent, canEditExercise } from "@/lib/permissions";
import { parseOr } from "@/lib/schemas/common";
import { ExerciseSchema } from "@/lib/schemas/exercise";
import type { Exercise, User } from "@/lib/types";

const NAME_MIN = 3;
const NAME_MAX = 50;
const DESC_CORTA_MIN = 10;
const DESC_CORTA_MAX = 200;

// Formulario propiamente dicho: se monta solo cuando ya se sabe qué datos
// precargar (o que no hay ninguno, en creación), con key={originalName} en
// el padre para inicializar el estado directamente desde props en vez de
// copiarlo con un efecto.
function ExerciseForm({
  original,
  originalName,
  profile,
}: {
  original: Exercise | null;
  originalName: string | null;
  profile: User;
}) {
  const router = useRouter();
  const isEdit = originalName !== null;

  const [name, setName] = useState(original?.name ?? "");
  const [descCorta, setDescCorta] = useState(original?.descCorta ?? "");
  const [descLarga, setDescLarga] = useState(original?.descLarga ?? "");
  const [privacy, setPrivacy] = useState<"Publico" | "Privado">(
    original?.privacy === "Privado" ? "Privado" : "Publico",
  );
  const [etiquetas, setEtiquetas] = useState<string[]>(original?.etiquetas ?? []);
  const [tagInput, setTagInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(original?.image ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const isNameValid = name.length >= NAME_MIN && name.length <= NAME_MAX;
  const isDescCortaValid =
    descCorta.length >= DESC_CORTA_MIN && descCorta.length <= DESC_CORTA_MAX;
  const canSave = isNameValid && isDescCortaValid && !saving;

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !etiquetas.includes(tag)) setEtiquetas([...etiquetas, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setEtiquetas(etiquetas.filter((t) => t !== tag));

  const save = async () => {
    setSaving(true);
    try {
      let imageUrl = imagePreview;
      if (imageFile) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("No autenticado");
        imageUrl = await uploadExerciseImage(uid, imageFile);
      }
      const input = {
        name: name.trim(),
        descCorta: descCorta.trim(),
        descLarga: descLarga.trim(),
        image: imageUrl,
        privacy,
        etiquetas,
      };
      if (isEdit) {
        await updateExercise(originalName, input, profile);
      } else {
        await createExercise(input, profile);
      }
      toast.success(
        privacy === "Publico"
          ? `Ejercicio ${isEdit ? "modificado" : "guardado"} y enviado a revisión`
          : `Ejercicio ${isEdit ? "modificado" : "guardado"} correctamente`,
      );
      router.replace(`/exercises/detail?name=${encodeURIComponent(input.name)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el ejercicio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <BackLink
        href={isEdit ? `/exercises/detail?name=${encodeURIComponent(originalName)}` : "/exercises"}
        label={isEdit ? "Ejercicio" : "Ejercicios"}
      />
      <h1 className="text-2xl font-bold">
        {isEdit ? "Editar ejercicio" : "Nuevo ejercicio"}
      </h1>

      <ImageUploadInput
        value={imagePreview}
        onChange={(file, preview) => {
          setImageFile(file);
          setImagePreview(preview);
        }}
      />

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
        <Label htmlFor="descCorta">Descripción corta</Label>
        <Textarea
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
        <Label htmlFor="descLarga">Descripción larga (opcional)</Label>
        <Textarea
          id="descLarga"
          value={descLarga}
          onChange={(e) => setDescLarga(e.target.value)}
        />
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

      <div className="space-y-1.5">
        <Label htmlFor="tagInput">Etiquetas</Label>
        <div className="flex gap-2">
          <Input
            id="tagInput"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Escribe y pulsa Enter"
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Añadir
          </Button>
        </div>
        {etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {etiquetas.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Quitar etiqueta ${tag}`}
                  className="rounded-full hover:bg-foreground/10"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Button className="w-full" size="xl" disabled={!canSave} onClick={() => void save()}>
        {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear ejercicio"}
      </Button>
    </div>
  );
}

function ExerciseEdit() {
  const params = useSearchParams();
  const originalName = params.get("name");
  const { profile } = useAuth();

  const [original, setOriginal] = useState<Exercise | null | undefined>(
    originalName ? undefined : null,
  );

  useEffect(() => {
    if (!originalName) return;
    void get(ref(db, `${PATHS.EXERCISES}/${originalName}`)).then(
      (snap) =>
        setOriginal(
          snap.exists()
            ? parseOr(ExerciseSchema, snap.val(), `Exercises/${originalName}`)
            : null,
        ),
      () => setOriginal(null),
    );
  }, [originalName]);

  if (profile === null || original === undefined) {
    return <DetailSkeleton />;
  }

  const allowed = originalName
    ? original !== null && canEditExercise(profile, original)
    : canCreateContent(profile);

  if (!allowed) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">
          {originalName
            ? "Este ejercicio no existe o no tienes permiso para editarlo."
            : "No tienes permiso para crear ejercicios."}
        </p>
        <BackLink href="/exercises" label="Ejercicios" />
      </div>
    );
  }

  return (
    <ExerciseForm
      key={originalName ?? "new"}
      original={original}
      originalName={originalName}
      profile={profile}
    />
  );
}

export default function ExerciseEditPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ExerciseEdit />
    </Suspense>
  );
}
