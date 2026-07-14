"use client";

import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Menú Editar/Duplicar/Eliminar reutilizado en cards y páginas de detalle
 * de ejercicio/entreno. "Eliminar" no anida un AlertDialogTrigger dentro
 * del DropdownMenuItem (el menú se cierra al seleccionar y se llevaría el
 * trigger con él) — en su lugar cierra el menú y abre un ConfirmDialog
 * controlado por separado.
 */
export function CardActionsMenu({
  editHref,
  onDuplicate,
  onDelete,
  deleteTitle,
  deleteDescription,
  className,
}: {
  editHref: string;
  /** Éxito y navegación (si procede) son responsabilidad del caller. */
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  deleteTitle: string;
  deleteDescription: string;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const duplicate = async () => {
    try {
      await onDuplicate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo duplicar");
    }
  };

  const del = async () => {
    try {
      await onDelete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
      throw e;
    }
  };

  return (
    <div
      className={cn("inline-flex", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={<Button variant="secondary" size="icon-sm" aria-label="Más acciones" />}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={editHref} />}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void duplicate()}>
            <Copy /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
          >
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel="Eliminar"
        destructive
        onConfirm={del}
      />
    </div>
  );
}
