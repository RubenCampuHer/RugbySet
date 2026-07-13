"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/lib/actions/favorites";
import { cn } from "@/lib/utils";

/** Estrella de favorito — espejo de _User.addRemoveFav* (nodo propio). */
export function FavoriteButton({
  kind,
  name,
}: {
  kind: "exercise" | "training";
  name: string;
}) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const list =
    kind === "exercise" ? profile?.favExercises : profile?.favTrainings;
  const isFav = (list ?? []).includes(name);

  const toggle = async () => {
    setBusy(true);
    try {
      const inserted = await toggleFavorite(kind, name);
      toast.success(inserted ? "Añadido a favoritos" : "Quitado de favoritos");
    } catch {
      toast.error("No se pudo actualizar el favorito");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="icon"
      variant="outline"
      aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
      aria-pressed={isFav}
      disabled={busy || !profile}
      className="size-10 shrink-0 rounded-full"
      onClick={() => void toggle()}
    >
      <Star
        className={cn(
          "size-5",
          isFav ? "fill-warning text-warning" : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
