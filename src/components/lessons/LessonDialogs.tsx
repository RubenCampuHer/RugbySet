"use client";

import { Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AudiencePicker } from "@/components/audience/AudiencePicker";
import { type Audience, normalizeAudience } from "@/lib/audience";
import { folderOptions, type Folders } from "@/lib/lessons";
import { cn } from "@/lib/utils";

/** Crear o editar carpeta: nombre y público (propio o el de la carpeta de arriba). Controlado por el padre. */
export function FolderDialog({
  open,
  onOpenChange,
  title,
  initialName = "",
  initialAudience = null,
  inherited,
  teams,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  /** Público propio actual (null = hereda). */
  initialAudience?: Audience | null;
  /** Público de la carpeta de arriba (o todo el club en la raíz). */
  inherited: Audience;
  teams: string[];
  submitLabel: string;
  onSubmit: (name: string, ownAudience: Audience | null) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [audience, setAudience] = useState<Audience | null>(initialAudience);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);
  // Al abrir, vuelve a los valores iniciales (sin efecto: ajuste durante el render).
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initialName);
      setAudience(initialAudience);
    }
  }

  const trimmed = name.trim();
  const own = audience ? normalizeAudience(audience) : null;
  const invalidAudience = Boolean(audience && !own);
  const submit = async () => {
    if (!trimmed || invalidAudience) return;
    setBusy(true);
    try {
      await onSubmit(trimmed, own);
      onOpenChange(false);
    } catch {
      // El aviso lo da quien llama; el diálogo sigue abierto para reintentar.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="folder-name">Nombre</Label>
            <Input
              id="folder-name"
              value={name}
              maxLength={120}
              autoFocus
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <AudiencePicker value={audience} onChange={setAudience} teams={teams} inherited={inherited} disabled={busy} />
        </form>
        <DialogFooter>
          <Button disabled={busy || !trimmed || invalidAudience} onClick={() => void submit()}>
            {busy ? "Guardando…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Elegir carpeta destino (o la raíz). `disabled` = carpetas que no valen (p. ej. la propia y sus hijas). */
export function FolderPickerDialog({
  open,
  onOpenChange,
  title,
  folders,
  current,
  disabled,
  onPick,
  rootLabel = "Lecciones (inicio)",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  folders: Folders;
  current: string | null;
  disabled?: (folderId: string) => boolean;
  onPick: (folderId: string | null) => Promise<void> | void;
  /** Nombre de la raíz en la lista. */
  rootLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const options = folderOptions(folders);

  const pick = async (id: string | null) => {
    setBusy(true);
    try {
      await onPick(id);
      onOpenChange(false);
    } catch {
      // Ídem: aviso del llamador, el diálogo sigue abierto.
    } finally {
      setBusy(false);
    }
  };

  const row = (id: string | null, label: string, depth: number) => {
    const isCurrent = id === current;
    const isDisabled = busy || isCurrent || (id !== null && disabled?.(id));
    return (
      <li key={id ?? "root"}>
        <button
          type="button"
          disabled={Boolean(isDisabled)}
          onClick={() => void pick(id)}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent",
            isCurrent && "font-medium",
          )}
          style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
        >
          {id === null ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0" />}
          <span className="truncate">{label}</span>
          {isCurrent && <span className="ml-auto shrink-0 text-xs text-muted-foreground">Aquí está</span>}
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-[60dvh] overflow-y-auto">
          {row(null, rootLabel, 0)}
          {options.map((o) => row(o.id, o.label, o.depth + 1))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
