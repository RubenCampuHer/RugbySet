"use client";

import { Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type InviteOption = { key: string; label: string; url: string; hint: string; shareText: string };

/**
 * "Invitar por enlace" (2026-09-25): copiar o compartir (menú nativo del
 * móvil: WhatsApp, etc.) un enlace con el código. Con varias opciones (p. ej.
 * jugador / co-entrenador) muestra un selector.
 */
export function InviteLinkDialog({
  title,
  description,
  options,
  triggerClassName,
}: {
  title: string;
  description: string;
  options: InviteOption[];
  triggerClassName?: string;
}) {
  const [selected, setSelected] = useState(options[0]?.key);
  const option = options.find((o) => o.key === selected) ?? options[0];
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(option.url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, text: option.shareText, url: option.url });
    } catch (e) {
      // Cerrar el menú de compartir no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("No se pudo compartir");
    }
  };

  if (!option) return null;

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" className={triggerClassName} />}>
        <Link2 className="size-4" /> Invitar por enlace
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {options.length > 1 && (
          <div className="inline-flex w-fit rounded-lg border p-0.5" role="radiogroup" aria-label="Invitar como">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={o.key === option.key}
                onClick={() => setSelected(o.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  o.key === option.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input readOnly value={option.url} aria-label="Enlace de invitación" onFocus={(e) => e.target.select()} />
          <Button variant="outline" onClick={() => void copy()} aria-label="Copiar enlace">
            <Copy className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{option.hint}</p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {canShare && (
            <Button variant="outline" onClick={() => void share()}>
              <Share2 className="size-4" /> Compartir
            </Button>
          )}
          <Button onClick={() => void copy()}>
            <Copy className="size-4" /> Copiar enlace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
