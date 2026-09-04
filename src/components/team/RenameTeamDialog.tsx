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
import { renameTeam } from "@/lib/actions/team";
import { validateTeamName } from "@/lib/team-validation";

/**
 * Renombrar el equipo — Teams/{teamname} usa el nombre como clave RTDB, así
 * que a diferencia de RenamePersonDialog esto pasa por una Cloud Function
 * (renameTeam) que mueve el subárbol entero. `onRenamed` es obligatorio: el
 * caller (TeamManager) tiene que navegar a la URL con el nombre nuevo — el
 * `teamname` viejo con el que se montó esta pantalla ya no existe.
 */
export function RenameTeamDialog({
  teamname,
  onRenamed,
}: {
  teamname: string;
  onRenamed: (newTeamname: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(teamname);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(teamname);
      setError(null);
    }
  };

  const save = async () => {
    const err = validateTeamName(name);
    setError(err);
    if (err) return;
    const trimmed = name.trim();
    if (trimmed === teamname) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const result = await renameTeam(teamname, trimmed);
      toast.success(`Equipo renombrado a ${result.teamname}`);
      setOpen(false);
      onRenamed(result.teamname);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo renombrar el equipo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button size="icon-sm" variant="ghost" aria-label={`Renombrar equipo ${teamname}`} />}
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="rename-team-input">Nombre del equipo</Label>
          <Input
            id="rename-team-input"
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
