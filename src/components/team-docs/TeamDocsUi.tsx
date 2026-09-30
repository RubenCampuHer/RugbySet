"use client";

import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Lock,
  Presentation,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeamDocSpace } from "@/lib/schemas/team-docs";
import type { FileKind } from "@/lib/team-docs";
import { cn } from "@/lib/utils";

export const SPACE_LABEL: Record<TeamDocSpace, string> = {
  team: "Todo el equipo",
  staff: "Solo cuerpo técnico",
};

/** Marca de lo que solo ve el cuerpo técnico (lo del equipo no lleva marca). */
export function StaffBadge({ space }: { space: TeamDocSpace }) {
  if (space !== "staff") return null;
  return (
    <Badge variant="outline" className="shrink-0">
      <Lock /> Cuerpo técnico
    </Badge>
  );
}

/** Elegir quién lo ve. `allowed` = espacios posibles en esa carpeta. */
export function SpacePicker({
  value,
  onChange,
  allowed,
  disabled,
}: {
  value: TeamDocSpace;
  onChange: (space: TeamDocSpace) => void;
  allowed: TeamDocSpace[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>Quién lo ve</Label>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quién lo ve">
        {(["team", "staff"] as const).map((space) => {
          const Icon = space === "team" ? Users : Lock;
          const selected = value === space;
          return (
            <button
              key={space}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled || !allowed.includes(space)}
              onClick={() => onChange(space)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm disabled:opacity-50",
                selected ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" /> {SPACE_LABEL[space]}
            </button>
          );
        })}
      </div>
      {!allowed.includes("team") && (
        <p className="text-xs text-muted-foreground">Está en una carpeta del cuerpo técnico: el equipo no la ve.</p>
      )}
    </div>
  );
}

/** Nombre (+ visibilidad al crear). Controlado por el padre. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  label = "Nombre",
  initialName = "",
  maxLength = 120,
  space,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label?: string;
  initialName?: string;
  maxLength?: number;
  /** Si viene, se elige la visibilidad (crear); si no, solo el nombre (renombrar). */
  space?: { initial: TeamDocSpace; allowed: TeamDocSpace[] };
  submitLabel: string;
  onSubmit: (name: string, space: TeamDocSpace) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [chosen, setChosen] = useState<TeamDocSpace>(space?.initial ?? "team");
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);
  // Al abrir, vuelve a los valores iniciales (ajuste durante el render, sin efecto).
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initialName);
      setChosen(space?.initial ?? "team");
    }
  }
  const trimmed = name.trim();
  const submit = async () => {
    if (!trimmed) return;
    setBusy(true);
    try {
      await onSubmit(trimmed, chosen);
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
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="team-doc-name">{label}</Label>
            <Input
              id="team-doc-name"
              value={name}
              maxLength={maxLength}
              autoFocus
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {space && <SpacePicker value={chosen} onChange={setChosen} allowed={space.allowed} disabled={busy} />}
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

const KIND_ICON: Record<FileKind, typeof File> = {
  pdf: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  word: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  archive: FileArchive,
  other: File,
};

export function FileKindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  return <Icon className={cn("size-5 shrink-0 text-muted-foreground", className)} />;
}
