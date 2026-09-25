"use client";

import { STARTER_POSITIONS } from "@/lib/lineup";
import { POSITION_SHORT } from "@/lib/player-info";
import { cn } from "@/lib/utils";

/** Dónde va cada puesto sobre el campo (% del ancho/alto): delanteros arriba, zaguero abajo. */
const SPOTS: Record<number, [number, number]> = {
  1: [28, 11],
  2: [50, 9],
  3: [72, 11],
  4: [40, 21],
  5: [60, 21],
  6: [18, 30],
  8: [50, 32],
  7: [82, 30],
  9: [36, 45],
  10: [58, 52],
  12: [42, 63],
  13: [64, 68],
  11: [12, 76],
  14: [88, 76],
  15: [50, 88],
};

export type PitchSlot = {
  /** Nombre a mostrar ("" = puesto vacío). */
  name: string;
  /** Aviso sobre el puesto: lesionado (rojo) o jugador fuera de sus puestos (ámbar). */
  warning?: "injured" | "offPosition" | null;
};

/**
 * Campo de rugby con los 15 titulares (2026-09-25). Con `onSelect` cada
 * puesto es un botón (editor); sin él es de solo lectura (vista del jugador).
 */
export function LineupPitch({
  slots,
  onSelect,
  selected,
}: {
  slots: Record<number, PitchSlot | undefined>;
  onSelect?: (pos: number) => void;
  selected?: number | null;
}) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-b from-emerald-950 via-emerald-900/80 to-emerald-950">
      {/* Líneas del campo: ensayo, 22, 10 y medio campo (mitad propia). */}
      <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 100 125" preserveAspectRatio="none">
        <g stroke="currentColor" className="text-white/15" strokeWidth="0.4" fill="none">
          <line x1="0" y1="2" x2="100" y2="2" />
          <line x1="0" y1="40" x2="100" y2="40" strokeDasharray="2 2" />
          <line x1="0" y1="78" x2="100" y2="78" strokeDasharray="1 2" />
          <line x1="0" y1="118" x2="100" y2="118" />
        </g>
      </svg>
      {STARTER_POSITIONS.map((pos) => {
        const [x, y] = SPOTS[pos];
        const slot = slots[pos];
        const filled = Boolean(slot?.name);
        const Tag = onSelect ? "button" : "div";
        return (
          <Tag
            key={pos}
            {...(onSelect ? { type: "button" as const, onClick: () => onSelect(pos) } : {})}
            aria-label={onSelect ? `${pos} · ${POSITION_SHORT[pos]}${filled ? `: ${slot!.name}` : " (vacío)"}` : undefined}
            className={cn(
              "absolute flex w-[4.75rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg p-0.5 outline-none",
              onSelect && "focus-visible:ring-2 focus-visible:ring-ring",
            )}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-bold transition-transform",
                filled ? "bg-white text-emerald-950 shadow" : "border border-dashed border-white/50 text-white/70",
                slot?.warning === "injured" && "ring-2 ring-destructive",
                slot?.warning === "offPosition" && "ring-2 ring-warning",
                selected === pos && "scale-110 ring-2 ring-brand",
                onSelect && "hover:scale-105",
              )}
            >
              {pos}
            </span>
            <span
              className={cn(
                "max-w-full truncate rounded px-1 text-[10px] leading-tight",
                filled ? "bg-black/45 font-medium text-white" : "text-white/60",
              )}
            >
              {filled ? slot!.name : POSITION_SHORT[pos]}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
