"use client";

import { Plus, Trash2, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteLineup, publishLineup, unpublishLineup, updateLineup } from "@/lib/actions/lineup";
import { fechaToInputValue, inputValueToFecha } from "@/lib/calendar";
import {
  findDuplicateName,
  nextBenchNumber,
  RUGBY_POSITIONS,
  STARTER_POSITIONS,
  takenNames,
} from "@/lib/lineup";
import type { LineupDoc, Team } from "@/lib/types";

const NO_TEMPLATE = "__none__";
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
            {options.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
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

/**
 * Editor de una alineación — entidad propia (Teams/{team}/lineups/{id}),
 * desacoplada del partido desde el rediseño 2026-09-03: puede no tener
 * fecha (plantilla suelta), y varias alineaciones distintas pueden existir
 * para el mismo partido (Plan A/B) — "publicada" ya no es un campo propio,
 * es que team.trainingdays[fecha].lineupId apunte a ESTA.
 */
export function LineupEditor({
  team,
  lineup,
  onDeleted,
}: {
  team: Team;
  lineup: LineupDoc;
  /** Ya no queda nada que editar tras borrar — quien la aloja (p.ej. el Sheet) debe cerrarse. */
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(lineup.name ?? "");
  const [matchFechaInput, setMatchFechaInput] = useState(
    lineup.matchFecha ? fechaToInputValue(lineup.matchFecha) : "",
  );
  const [starters, setStarters] = useState<Record<string, string>>(lineup.starters);
  const [bench, setBench] = useState<Record<string, string>>(lineup.bench);
  const [benchOrder, setBenchOrder] = useState<number[]>(() =>
    Object.keys(lineup.bench)
      .map(Number)
      .sort((a, b) => a - b),
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Ver LineupEditor (versión embebida anterior): cada fila decide
  // "roster o texto libre" una sola vez al montar; forzar remount al
  // copiar una plantilla para que cada una lo vuelva a decidir con el
  // dato recién copiado.
  const [templateVersion, setTemplateVersion] = useState(0);

  const matchFecha = inputValueToFecha(matchFechaInput);
  const linkedDay = matchFecha ? team.trainingdays.find((d) => d.fecha === matchFecha) : undefined;
  const isPublished = Boolean(linkedDay && linkedDay.lineupId === lineup.lineupId);

  const setStarter = (pos: number, value: string) => {
    setStarters((prev) => {
      const next = { ...prev };
      if (value) next[String(pos)] = value;
      else delete next[String(pos)];
      return next;
    });
  };
  const setBenchSlot = (num: number, value: string) => {
    setBench((prev) => {
      const next = { ...prev };
      if (value) next[String(num)] = value;
      else delete next[String(num)];
      return next;
    });
  };
  const removeBenchSlot = (num: number) => {
    setBenchOrder((prev) => prev.filter((n) => n !== num));
    setBench((prev) => {
      const next = { ...prev };
      delete next[String(num)];
      return next;
    });
  };
  const addBenchSlot = () => {
    setBenchOrder((prev) => [...prev, nextBenchNumber(prev)]);
  };

  // Copiar de otra alineación del equipo (cualquiera — con o sin partido,
  // publicada o no) como punto de partida para ESTA. Solo se copian
  // titulares/banquillo — nombre y fecha de la alineación que se está
  // editando no cambian.
  const otherLineups = Object.values(team.lineups)
    .filter((l) => l.lineupId !== lineup.lineupId)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const applyTemplate = (sourceId: string) => {
    const source = otherLineups.find((l) => l.lineupId === sourceId);
    if (!source) return;
    setStarters(source.starters);
    setBench(source.bench);
    setBenchOrder(Object.keys(source.bench).map(Number).sort((a, b) => a - b));
    setTemplateVersion((v) => v + 1);
    toast.success(`Alineación "${source.name || "sin nombre"}" copiada — revisa y guarda.`);
  };

  const cleanAssignments = () => ({
    starters: Object.fromEntries(Object.entries(starters).filter(([, v]) => v)),
    bench: Object.fromEntries(Object.entries(bench).filter(([, v]) => v)),
  });

  const persist = async () => {
    const clean = cleanAssignments();
    const duplicate = findDuplicateName(clean);
    if (duplicate) {
      toast.error(`"${duplicate}" está asignado en más de una posición`);
      return false;
    }
    await updateLineup(team.teamname!, lineup.lineupId!, {
      name,
      matchFecha,
      ...clean,
    });
    return true;
  };

  const save = async () => {
    setSaving(true);
    try {
      const ok = await persist();
      if (ok) toast.success("Alineación guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la alineación");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!matchFecha) {
      toast.error("Asigna primero una fecha de partido para poder publicarla.");
      return;
    }
    setPublishing(true);
    try {
      const ok = await persist();
      if (!ok) return;
      await publishLineup(team.teamname!, lineup.lineupId!, matchFecha, name || null, team.trainingdays);
      toast.success("Alineación publicada — el equipo ya puede verla.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo publicar la alineación");
    } finally {
      setPublishing(false);
    }
  };

  const unpublish = async () => {
    if (!matchFecha) return;
    setPublishing(true);
    try {
      await unpublishLineup(team.teamname!, matchFecha, team.trainingdays);
      toast.success("Alineación despublicada — ya no la ve el equipo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo despublicar");
    } finally {
      setPublishing(false);
    }
  };

  const remove = async () => {
    try {
      await deleteLineup(team.teamname!, lineup.lineupId!, team.trainingdays);
      toast.success("Alineación eliminada");
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar la alineación");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="lineup-name" className="text-xs">
          Nombre
        </Label>
        <Input
          id="lineup-name"
          value={name}
          placeholder="p.ej. Plan A, Titular vs Leones RC…"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="lineup-fecha" className="text-xs">
          Fecha del partido (opcional — vacío = plantilla suelta)
        </Label>
        <Input
          id="lineup-fecha"
          type="date"
          value={matchFechaInput}
          disabled={isPublished}
          onChange={(e) => setMatchFechaInput(e.target.value)}
        />
        {isPublished && (
          <p className="text-xs text-muted-foreground">
            Publicada — despublica primero para cambiar la fecha.
          </p>
        )}
      </div>

      {otherLineups.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Copiar de otra alineación</Label>
          <Select value={NO_TEMPLATE} onValueChange={(v) => v && v !== NO_TEMPLATE && applyTemplate(v)}>
            <SelectTrigger className="w-full" aria-label="Copiar de otra alineación">
              <SelectValue>Elegir alineación…</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEMPLATE}>Elegir alineación…</SelectItem>
              {otherLineups.map((l) => (
                <SelectItem key={l.lineupId} value={l.lineupId!}>
                  {l.name || "(sin nombre)"} {l.matchFecha ? `· ${l.matchFecha}` : "· plantilla"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        {STARTER_POSITIONS.map((pos) => (
          <LineupRow
            key={`${pos}-${templateVersion}`}
            rowKey={String(pos)}
            label={RUGBY_POSITIONS[pos]}
            value={starters[String(pos)] ?? ""}
            players={team.userplayers}
            takenElsewhere={takenNames({ starters, bench }, String(pos))}
            onChange={(v) => setStarter(pos, v)}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Suplentes</p>
        {benchOrder.map((num) => (
          <LineupRow
            key={`${num}-${templateVersion}`}
            rowKey={String(num)}
            label="Suplente"
            value={bench[String(num)] ?? ""}
            players={team.userplayers}
            takenElsewhere={takenNames({ starters, bench }, String(num))}
            onChange={(v) => setBenchSlot(num, v)}
            onRemove={() => removeBenchSlot(num)}
          />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addBenchSlot}>
          <Plus className="size-3.5" /> Añadir suplente
        </Button>
      </div>

      <Button size="xl" className="w-full" disabled={saving || publishing} onClick={() => void save()}>
        Guardar
      </Button>

      {isPublished ? (
        <Button
          size="xl"
          variant="outline"
          className="w-full"
          disabled={saving || publishing}
          onClick={() => void unpublish()}
        >
          Despublicar
        </Button>
      ) : (
        <div className="space-y-1">
          <Button
            size="xl"
            variant="outline"
            className="w-full"
            disabled={saving || publishing || !matchFecha}
            onClick={() => void publish()}
          >
            Publicar para este partido
          </Button>
          {!matchFecha && (
            <p className="text-xs text-muted-foreground">
              Asigna una fecha de partido arriba para poder publicarla.
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        trigger={
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
            <Trash2 className="size-4" /> Eliminar alineación
          </Button>
        }
        title={`¿Eliminar "${name || "esta alineación"}"?`}
        description={
          isPublished
            ? "Está publicada — el partido se quedará sin alineación asignada."
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
