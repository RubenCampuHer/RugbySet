"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLUB_CATEGORIES,
  randomCodeSuffix,
  suggestTeamCode,
  validateTeamCode,
  validateTeamName,
} from "@/lib/team-validation";

/** Selector de imagen simple (sin recortador) — mirror de team/page.tsx (icono de equipo). */
export function IconPicker({
  preview,
  onChange,
  label,
}: {
  preview: string | null;
  onChange: (file: File | null, previewUrl: string | null) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          onChange(file, file ? URL.createObjectURL(file) : null);
        }}
      />
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview local, sin optimizador (output: export)
          <img src={preview} alt="" className="size-12 rounded-full object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ImagePlus className="size-5" />
          </div>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {preview ? "Cambiar" : "Añadir imagen"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Formulario de creación de equipo (nombre, código autosugerido, categoría
 * opcional, icono, "también jugador"). Extraído del wizard de onboarding
 * (2026-09-04, varios equipos) para reutilizarlo en "Crear otro equipo"
 * desde la pestaña Equipo (CreateTeamDialog).
 */
export function TeamForm({
  submitLabel,
  busy,
  withCategory,
  onSubmit,
}: {
  submitLabel: string;
  busy: boolean;
  withCategory?: boolean;
  onSubmit: (data: {
    name: string;
    code: string;
    iconFile: File | null;
    category?: string;
    alsoPlayer: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  // Desmarcado por defecto (rediseño multi-coach 2026-09-03): ser
  // entrenador ya no implica ser jugador — quien también juega lo marca
  // explícitamente.
  const [alsoPlayer, setAlsoPlayer] = useState(false);
  // Código autosugerido desde el nombre — el entrenador confundía "Código
  // de acceso" con algo que debía recibir, no inventar (ver plan onboarding
  // 2026-09-03). Precargarlo, editable, deja claro que es él quien lo
  // elige. Mientras no lo toque directamente (codeTouched=false), sigue al
  // nombre en vivo; en cuanto lo edita o pide "Sugerir otro", deja de
  // seguirlo para no pisar su elección.
  const [suffix, setSuffix] = useState(() => randomCodeSuffix());
  const [codeTouched, setCodeTouched] = useState(false);
  const [code, setCode] = useState(() => suggestTeamCode("", suffix));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(CLUB_CATEGORIES[0]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameError(null);
    if (!codeTouched) setCode(suggestTeamCode(value, suffix));
  };

  const regenerateCode = () => {
    const newSuffix = randomCodeSuffix();
    setSuffix(newSuffix);
    setCode(suggestTeamCode(name, newSuffix));
    setCodeTouched(true);
    setCodeError(null);
  };

  const submit = () => {
    const nameErr = validateTeamName(name);
    setNameError(nameErr);
    const codeErr = validateTeamCode(code);
    setCodeError(codeErr);
    if (nameErr || codeErr) return;
    onSubmit({
      name: name.trim(),
      code: code.trim(),
      iconFile,
      category: withCategory ? category : undefined,
      alsoPlayer,
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="team-name">Nombre del equipo</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={busy}
        />
        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="team-code">Código de acceso</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground"
            disabled={busy}
            onClick={regenerateCode}
          >
            🔄 Sugerir otro
          </Button>
        </div>
        <Input
          id="team-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeTouched(true);
            setCodeError(null);
          }}
          disabled={busy}
        />
        <p className="text-xs text-muted-foreground">
          Lo eliges tú (o usa el sugerido) — se lo compartirás a tus jugadores para unirse.
        </p>
        {codeError && <p className="text-sm text-destructive">{codeError}</p>}
      </div>
      {withCategory && (
        <div className="space-y-1">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? CLUB_CATEGORIES[0])} disabled={busy}>
            <SelectTrigger className="w-full">
              <SelectValue>{category}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CLUB_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <IconPicker
        label="Icono del equipo (opcional)"
        preview={iconPreview}
        onChange={(file, url) => { setIconFile(file); setIconPreview(url); }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={alsoPlayer}
          disabled={busy}
          onChange={(e) => setAlsoPlayer(e.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        También quiero aparecer como jugador
      </label>
      <Button className="w-full" disabled={busy || !name.trim() || !code.trim()} onClick={submit}>
        {busy ? "Creando…" : submitLabel}
      </Button>
    </div>
  );
}
