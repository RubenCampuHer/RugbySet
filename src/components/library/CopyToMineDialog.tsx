"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateContentName } from "@/lib/library";

/**
 * "Copiar a mis entrenos/ejercicios" (2026-09-23): pide el nombre de la
 * copia (es la clave en RTDB) y la crea privada. Pensado para contenido de
 * otros autores — el propio ya tiene "Duplicar" en su menú.
 */
export function CopyToMineDialog({
  kind,
  sourceName,
  onCopy,
}: {
  kind: "training" | "exercise";
  sourceName: string;
  /** Crea la copia y devuelve el nombre final; los errores se muestran en el diálogo. */
  onCopy: (newName: string) => Promise<void>;
}) {
  const noun = kind === "training" ? "entrenos" : "ejercicios";
  const suggested = `${sourceName} (mío)`.slice(0, 50);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggested);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(suggested);
      setError(null);
    }
  };

  const save = async () => {
    const err = validateContentName(name);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await onCopy(name.trim());
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo copiar";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Copy className="size-4" /> Copiar a mis {noun}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar a mis {noun}</DialogTitle>
          <DialogDescription>
            Se crea una copia privada que puedes adaptar sin tocar el original. Quedará anotado
            de dónde viene.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="copy-name-input">Nombre de la copia</Label>
          <Input
            id="copy-name-input"
            value={name}
            autoFocus
            disabled={busy}
            maxLength={50}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Copiando…" : "Crear copia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
