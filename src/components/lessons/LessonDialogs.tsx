"use client";

import { Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { folderOptions, type Folders } from "@/lib/lessons";
import { cn } from "@/lib/utils";

/** Nombre de carpeta (crear o renombrar). Controlado por el padre. */
export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  initialName = "",
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);
  // Al abrir, vuelve al nombre inicial (sin efecto: ajuste durante el render).
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setName(initialName);
  }

  const trimmed = name.trim();
  const submit = async () => {
    if (!trimmed) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } catch {
      // El aviso lo da quien llama; el diálogo sigue abierto para reintentar.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Label htmlFor="folder-name">Nombre</Label>
          <Input
            id="folder-name"
            value={name}
            maxLength={120}
            autoFocus
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </form>
        <DialogFooter>
          <Button disabled={busy || !trimmed} onClick={() => void submit()}>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  folders: Folders;
  current: string | null;
  disabled?: (folderId: string) => boolean;
  onPick: (folderId: string | null) => Promise<void> | void;
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
          {row(null, "Lecciones (inicio)", 0)}
          {options.map((o) => row(o.id, o.label, o.depth + 1))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
