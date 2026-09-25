"use client";

import { Shirt, Star } from "lucide-react";
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
import { setPlayerInfo } from "@/lib/actions/team";
import { MAX_POSITIONS, POSITION_GROUPS, POSITION_SHORT, makeMain, togglePosition } from "@/lib/player-info";
import type { PlayerInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Ficha del jugador en el equipo (2026-09-25) — solo el cuerpo técnico:
 * puestos (máx. 5, el primero es el principal), dorsal, capitán, lesionado.
 * Alimenta las sugerencias del editor de alineaciones.
 */
export function PlayerInfoDialog({
  teamname,
  uid,
  name,
  info,
}: {
  teamname: string;
  uid: string;
  name: string;
  info: PlayerInfo;
}) {
  const [open, setOpen] = useState(false);
  const [positions, setPositions] = useState<number[]>([]);
  const [number, setNumber] = useState("");
  const [captain, setCaptain] = useState(false);
  const [injured, setInjured] = useState(false);
  const [busy, setBusy] = useState(false);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setPositions(info.positions);
      setNumber(info.number ? String(info.number) : "");
      setCaptain(!!info.captain);
      setInjured(!!info.injured);
    }
  };

  const save = async () => {
    const n = number.trim() ? Number(number) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 99)) {
      toast.error("El dorsal debe ser un número del 1 al 99");
      return;
    }
    setBusy(true);
    try {
      await setPlayerInfo(teamname, uid, { positions, number: n, captain, injured });
      toast.success("Ficha guardada");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la ficha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="icon-xl"
            variant="ghost"
            className="rounded-full"
            aria-label={`Ficha de ${name}: puestos y dorsal`}
            title="Puestos y dorsal"
          />
        }
      >
        <Shirt className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ficha de {name}</DialogTitle>
          <DialogDescription>
            Hasta {MAX_POSITIONS} puestos. El primero es su puesto principal; toca uno de los elegidos para hacerlo principal.
          </DialogDescription>
        </DialogHeader>

        {POSITION_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {group.positions.map((p) => {
                const selected = positions.includes(p);
                const full = !selected && positions.length >= MAX_POSITIONS;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={selected}
                    disabled={full}
                    onClick={() => setPositions(togglePosition(positions, p))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-40",
                      selected ? "border-brand bg-brand/10 text-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {p}
                    </span>
                    <span className="truncate">{POSITION_SHORT[p]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex min-h-7 flex-wrap items-center gap-1.5" aria-label="Puestos elegidos, en orden">
          {positions.length === 0 && <span className="text-xs text-muted-foreground">Sin puestos elegidos.</span>}
          {positions.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setPositions(makeMain(positions, p))}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                i === 0 ? "border-brand bg-brand/15 text-brand" : "text-muted-foreground hover:text-foreground",
              )}
              title={i === 0 ? "Puesto principal" : "Hacer principal"}
            >
              {i === 0 && <Star className="size-3 fill-current" />}
              {p} · {POSITION_SHORT[p]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={`dorsal-${uid}`} className="text-xs">
              Dorsal habitual
            </Label>
            <Input
              id={`dorsal-${uid}`}
              inputMode="numeric"
              value={number}
              placeholder="—"
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
          </div>
          <div className="flex flex-col gap-2 pb-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={captain}
                onChange={(e) => setCaptain(e.target.checked)}
                className="size-4 accent-primary"
              />
              Capitán
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={injured}
                onChange={(e) => setInjured(e.target.checked)}
                className="size-4 accent-primary"
              />
              Lesionado
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar ficha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
