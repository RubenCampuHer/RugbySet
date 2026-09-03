"use client";

import { Plus, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveLineup } from "@/lib/actions/team";
import {
  findDuplicateName,
  nextBenchNumber,
  RUGBY_POSITIONS,
  STARTER_POSITIONS,
  takenNames,
} from "@/lib/lineup";
import type { Lineup, Team, TrainingDay } from "@/lib/types";

const NONE = "__none__";
const MANUAL = "__manual__";

/**
 * Fila de una posición/dorsal: Select con el roster del equipo (menos los
 * ya asignados a otra fila) + una opción "Otro" que cambia la fila a texto
 * libre — para convocar a alguien sin cuenta en la app (un juvenil que
 * sube, un fichaje nuevo…). El valor guardado es el mismo texto tanto si
 * viene del roster como si se escribió a mano.
 */
function LineupRow({
  rowKey,
  label,
  value,
  players,
  takenElsewhere,
  onChange,
  onRemove,
}: {
  rowKey: string;
  label: string;
  value: string;
  players: string[];
  takenElsewhere: Set<string>;
  onChange: (name: string) => void;
  onRemove?: () => void;
}) {
  const inRoster = value === "" || players.includes(value);
  const [manual, setManual] = useState(!inRoster);
  const options = players.filter((p) => !takenElsewhere.has(p));

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-muted-foreground">{rowKey}</span>
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      {manual ? (
        <>
          <Input
            value={value}
            placeholder="Nombre y apellidos"
            aria-label={`${label} (nombre manual)`}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Volver a elegir del equipo"
            onClick={() => {
              setManual(false);
              onChange("");
            }}
          >
            <Undo2 className="size-4" />
          </Button>
        </>
      ) : (
        <Select
          value={value === "" ? NONE : value}
          onValueChange={(v) => {
            if (v === MANUAL) {
              setManual(true);
              onChange("");
            } else if (v === NONE) {
              onChange("");
            } else {
              onChange(v ?? "");
            }
          }}
        >
          <SelectTrigger className="min-w-0 flex-1" aria-label={label}>
            {/* min-w-0 en dos niveles: el trigger ya se encoge (flex-1),
                pero SelectValue es a su vez un flex item interno
                (flex flex-1, sin min-w-0 propio) — sin este segundo
                min-w-0 el nombre largo desborda el trigger en vez de
                truncar (verificado con un harness a 360px). */}
            <SelectValue className="min-w-0">
              <span className="truncate">{value || "Sin asignar"}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin asignar</SelectItem>
            {options.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
            <SelectItem value={MANUAL}>Otro (escribir nombre)…</SelectItem>
          </SelectContent>
        </Select>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar suplente"
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

const EMPTY_LINEUP: Lineup = { published: false, starters: {}, bench: {} };

/** Editor de alineación de un Partido — 15 posiciones fijas + banquillo dinámico, borrador/publicar. */
export function LineupEditor({ team, day }: { team: Team; day: TrainingDay }) {
  const [lineup, setLineup] = useState<Lineup>(day.lineup ?? EMPTY_LINEUP);
  // Qué filas de banquillo se VEN, por separado de qué nombre tiene cada
  // una: RTDB no persiste valores vacíos, así que una fila añadida (o
  // vaciada para escribir un nombre a mano) no tiene clave en
  // lineup.bench todavía — si la lista de filas saliera de
  // Object.keys(lineup.bench), esa fila desaparecería en cuanto se
  // vaciara (bug real: "al escribir nombre en suplente se borra la
  // fila"). benchOrder es la lista de dorsales visibles; lineup.bench
  // solo guarda los ya asignados.
  const [benchOrder, setBenchOrder] = useState<number[]>(() =>
    Object.keys((day.lineup ?? EMPTY_LINEUP).bench)
      .map(Number)
      .sort((a, b) => a - b),
  );
  const [saving, setSaving] = useState(false);

  const setStarter = (pos: number, name: string) => {
    setLineup((prev) => {
      const starters = { ...prev.starters };
      if (name) starters[String(pos)] = name;
      else delete starters[String(pos)];
      return { ...prev, starters };
    });
  };
  const setBenchSlot = (num: number, name: string) => {
    setLineup((prev) => {
      const bench = { ...prev.bench };
      if (name) bench[String(num)] = name;
      else delete bench[String(num)];
      return { ...prev, bench };
    });
  };
  const removeBenchSlot = (num: number) => {
    setBenchOrder((prev) => prev.filter((n) => n !== num));
    setLineup((prev) => {
      const bench = { ...prev.bench };
      delete bench[String(num)];
      return { ...prev, bench };
    });
  };
  const addBenchSlot = () => {
    setBenchOrder((prev) => [...prev, nextBenchNumber(prev)]);
  };

  const save = async () => {
    // Defensivo: una fila de banquillo recién añadida y nunca asignada no
    // debe persistirse vacía.
    const clean: Lineup = {
      ...lineup,
      starters: Object.fromEntries(Object.entries(lineup.starters).filter(([, v]) => v)),
      bench: Object.fromEntries(Object.entries(lineup.bench).filter(([, v]) => v)),
    };
    // Un nombre escrito a mano en dos filas distintas no pasa por ningún
    // roster que lo impida (a diferencia de elegir dos veces del equipo,
    // que el Select ya evita) — se valida aquí antes de guardar.
    const duplicate = findDuplicateName(clean);
    if (duplicate) {
      toast.error(`"${duplicate}" está asignado en más de una posición`);
      return;
    }
    setSaving(true);
    try {
      await saveLineup(team.teamname!, day.fecha!, clean, team.trainingdays);
      toast.success(clean.published ? "Alineación publicada" : "Alineación guardada como borrador");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la alineación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {STARTER_POSITIONS.map((pos) => (
          <LineupRow
            key={pos}
            rowKey={String(pos)}
            label={RUGBY_POSITIONS[pos]}
            value={lineup.starters[String(pos)] ?? ""}
            players={team.userplayers}
            takenElsewhere={takenNames(lineup, String(pos))}
            onChange={(name) => setStarter(pos, name)}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Suplentes</p>
        {benchOrder.map((num) => (
          <LineupRow
            key={num}
            rowKey={String(num)}
            label="Suplente"
            value={lineup.bench[String(num)] ?? ""}
            players={team.userplayers}
            takenElsewhere={takenNames(lineup, String(num))}
            onChange={(name) => setBenchSlot(num, name)}
            onRemove={() => removeBenchSlot(num)}
          />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addBenchSlot}>
          <Plus className="size-3.5" /> Añadir suplente
        </Button>
      </div>

      <div className="space-y-1">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={!lineup.published ? "default" : "outline"}
            className="flex-1"
            onClick={() => setLineup((prev) => ({ ...prev, published: false }))}
          >
            Borrador
          </Button>
          <Button
            type="button"
            variant={lineup.published ? "default" : "outline"}
            className="flex-1"
            onClick={() => setLineup((prev) => ({ ...prev, published: true }))}
          >
            Publicada
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {lineup.published
            ? "Cualquier jugador del equipo puede verla."
            : "En borrador: solo la ves tú, hasta que la publiques."}
        </p>
      </div>

      <Button size="xl" className="w-full" disabled={saving} onClick={() => void save()}>
        Guardar
      </Button>
    </div>
  );
}
