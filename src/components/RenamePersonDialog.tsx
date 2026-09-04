"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateNameSurname } from "@/lib/actions/profile";
import { validateNameSurname } from "@/lib/profile-validation";

/**
 * Editar el nombre de una persona — reutilizado en las 3 superficies donde
 * está permitido (2026-09-04): el propio perfil (self), la fila de un
 * jugador en TeamManager (su coach) y /admin/users (ADMIN). Quién puede
 * hacerlo de verdad lo decide la regla de Users/{uid}/nameSurname — este
 * componente no distingue casos, solo abre el diálogo y llama a la acción.
 */
export function RenamePersonDialog({
  uid,
  currentName,
  ariaLabel,
  triggerSize = "icon-sm",
}: {
  uid: string;
  currentName: string;
  /** Por defecto "Editar nombre de {currentName}" — pásalo explícito si currentName está vacío. */
  ariaLabel?: string;
  /** icon-xl en filas con objetivo táctil de 44px (TeamManager); icon-sm en el resto. */
  triggerSize?: "icon-sm" | "icon-xl";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(currentName);
      setError(null);
    }
  };

  const save = async () => {
    const err = validateNameSurname(name);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await updateNameSurname(uid, name);
      toast.success("Nombre actualizado");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el nombre");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            size={triggerSize}
            variant="ghost"
            className={triggerSize === "icon-xl" ? "rounded-full" : undefined}
            aria-label={ariaLabel ?? `Editar nombre de ${currentName}`}
          />
        }
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar nombre</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="rename-person-input">Nombre y apellidos</Label>
          <Input
            id="rename-person-input"
            value={name}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
