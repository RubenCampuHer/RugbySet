"use client";

import { Plus, Star, Trash2, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/AvatarInitials";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LineupPitch, type PitchSlot } from "@/components/lineup/LineupPitch";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfilesByUid } from "@/hooks/useProfilesByUid";
import { deleteLineup, updateLineup } from "@/lib/actions/lineup";
import {
  findDuplicateSlot,
  lineupSlots,
  nextBenchNumber,
  RUGBY_POSITIONS,
  slotsToStored,
  type LineupSlot,
  type LineupSlots,
} from "@/lib/lineup";
import { POSITION_SHORT, playerInfoOf, positionFit, rankCandidates, type Candidate } from "@/lib/player-info";
import type { LineupDoc, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_TEMPLATE = "__none__";

type SlotKey = { kind: "starters" | "bench"; key: string };

/**
 * Selector de jugador para un puesto: primero quien tiene ese puesto en su
 * ficha (★ principal), luego el resto, lesionados al final. Elegir a alguien
 * que ya está en otro puesto lo MUEVE aquí. Admite un nombre escrito a mano
 * (alguien sin cuenta: un juvenil que sube, un fichaje nuevo…).
 */
function SlotPicker({
  target,
  candidates,
  where,
  current,
  squad,
  onPick,
  onClose,
}: {
  target: SlotKey;
  candidates: Candidate[];
  /** Convocados del partido (si hay convocatoria): el resto sale aparte. */
  squad: Set<string> | null;
  /** Dónde está ya cada uid ("12", "S16"…). */
  where: Map<string, string>;
  current: LineupSlot | undefined;
  onPick: (slot: LineupSlot | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState(current && !current.uid ? current.name : "");
  const pos = target.kind === "starters" ? Number(target.key) : null;
  const title = pos ? `${pos} · ${RUGBY_POSITIONS[pos]}` : `Suplente ${target.key}`;

  const ranked = pos ? rankCandidates(candidates, pos) : [...candidates].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const visible = ranked.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const called = visible.filter((c) => !squad || squad.has(c.uid));
  const fits = pos ? called.filter((c) => !c.info.injured && positionFit(c.info, pos)) : [];
  const rest = called.filter((c) => !c.info.injured && !(pos && positionFit(c.info, pos)));
  const injured = called.filter((c) => c.info.injured);
  const notCalled = squad ? visible.filter((c) => !squad.has(c.uid)) : [];

  const row = (c: Candidate) => {
    const fit = pos ? positionFit(c.info, pos) : null;
    const at = where.get(c.uid);
    const isCurrent = current?.uid === c.uid;
    return (
      <button
        key={c.uid}
        type="button"
        onClick={() => onPick({ name: c.name, uid: c.uid })}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
          isCurrent && "bg-brand/10",
        )}
      >
        <AvatarInitials name={c.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
            {fit === "main" && <Star className="size-3 shrink-0 fill-brand text-brand" />}
            {c.name}
            {c.info.number ? <span className="text-xs font-normal text-muted-foreground">#{c.info.number}</span> : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {c.info.positions.length > 0 ? c.info.positions.map((p) => POSITION_SHORT[p]).join(" · ") : "Sin puestos en su ficha"}
          </span>
        </span>
        {c.info.injured && <span className="shrink-0 text-xs text-destructive">Lesionado</span>}
        {at && !isCurrent && <span className="shrink-0 text-xs text-muted-foreground">en el {at}</span>}
      </button>
    );
  };

  const section = (label: string, list: Candidate[]) =>
    list.length > 0 && (
      <div className="space-y-0.5">
        <p className="px-2 pt-2 text-xs font-medium text-muted-foreground">{label}</p>
        {list.map(row)}
      </div>
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {candidates.length > 6 && <SearchInput value={search} onChange={setSearch} placeholder="Buscar jugador…" />}
        <div>
          {pos && section("Su puesto", fits)}
          {section(squad ? (pos ? "Resto de convocados" : "Convocados") : pos ? "Resto del equipo" : "Equipo", rest)}
          {section("Lesionados", injured)}
          {section("No convocados", notCalled)}
          {visible.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {candidates.length === 0 ? "El equipo aún no tiene jugadores." : "Nadie con ese nombre."}
            </p>
          )}
        </div>
        <div className="space-y-1.5 border-t pt-3">
          <Label htmlFor="slot-manual" className="text-xs text-muted-foreground">
            Alguien sin cuenta en la app
          </Label>
          <div className="flex gap-2">
            <Input
              id="slot-manual"
              value={manual}
              placeholder="Nombre y apellidos"
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && manual.trim() && onPick({ name: manual.trim(), uid: null })}
            />
            <Button variant="outline" disabled={!manual.trim()} onClick={() => onPick({ name: manual.trim(), uid: null })}>
              <UserPlus className="size-4" /> Poner
            </Button>
          </div>
        </div>
        {current?.name && (
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onPick(null)}>
            <X className="size-4" /> Quitar de este puesto
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Editor de una alineación — entidad propia (Teams/{team}/lineups/{id}),
 * desacoplada del partido (la asignación vive en el Calendario, DayPanel).
 * Rediseño 2026-09-25: titulares sobre un campo de rugby, selector por
 * puesto que sugiere según la ficha del jugador (puestos, lesionado) y
 * guarda quién es cada puesto (players, uid) además del nombre (Android).
 */
export function LineupEditor({
  team,
  lineup,
  squad = null,
  onDeleted,
}: {
  team: Team;
  lineup: LineupDoc;
  /** Convocados del partido al que está asignada (desde el Calendario). */
  squad?: string[] | null;
  /** Ya no queda nada que editar tras borrar — quien la aloja (p.ej. el Sheet) debe cerrarse. */
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(lineup.name ?? "");
  const [slots, setSlots] = useState<LineupSlots>(() => lineupSlots(lineup));
  const [benchOrder, setBenchOrder] = useState<number[]>(() =>
    Object.keys(lineup.bench)
      .map(Number)
      .sort((a, b) => a - b),
  );
  const [picking, setPicking] = useState<SlotKey | null>(null);
  const [saving, setSaving] = useState(false);

  const playerUids = useMemo(() => Object.keys(team.userplayers), [team.userplayers]);
  const squadSet = useMemo(() => (squad && squad.length > 0 ? new Set(squad) : null), [squad]);
  const profiles = useProfilesByUid(playerUids);
  const candidates: Candidate[] = playerUids.map((uid) => ({
    uid,
    name: profiles[uid]?.nameSurname || "Jugador",
    info: playerInfoOf(team, uid),
  }));

  // Nombre a mostrar: el actual del perfil si el puesto tiene uid (renombres).
  const displayName = (slot: LineupSlot | undefined) =>
    slot ? (slot.uid && profiles[slot.uid]?.nameSurname) || slot.name : "";

  const where = new Map<string, string>();
  for (const [key, slot] of Object.entries(slots.starters)) if (slot.uid) where.set(slot.uid, key);
  for (const [key, slot] of Object.entries(slots.bench)) if (slot.uid) where.set(slot.uid, `S${key}`);

  const pitchSlots: Record<number, PitchSlot> = {};
  for (const [key, slot] of Object.entries(slots.starters)) {
    const info = slot.uid ? playerInfoOf(team, slot.uid) : null;
    pitchSlots[Number(key)] = {
      name: displayName(slot),
      warning: info?.injured
        ? "injured"
        : info && info.positions.length > 0 && !positionFit(info, Number(key))
          ? "offPosition"
          : null,
    };
  }

  const assignedFechas = team.trainingdays
    .filter((d) => d.lineupId === lineup.lineupId)
    .map((d) => d.fecha)
    .filter((f): f is string => Boolean(f));

  const pick = (target: SlotKey, slot: LineupSlot | null) => {
    setSlots((prev) => {
      const next: LineupSlots = { starters: { ...prev.starters }, bench: { ...prev.bench } };
      // Si ya estaba en otro puesto, se mueve (no se duplica).
      if (slot?.uid) {
        for (const kind of ["starters", "bench"] as const) {
          for (const [k, s] of Object.entries(next[kind])) if (s.uid === slot.uid) delete next[kind][k];
        }
      }
      if (slot) next[target.kind][target.key] = slot;
      else delete next[target.kind][target.key];
      return next;
    });
    setPicking(null);
  };

  const removeBenchSlot = (num: number) => {
    setBenchOrder((prev) => prev.filter((n) => n !== num));
    setSlots((prev) => {
      const bench = { ...prev.bench };
      delete bench[String(num)];
      return { ...prev, bench };
    });
  };
  const addBenchSlot = () => {
    const num = nextBenchNumber(benchOrder);
    setBenchOrder((prev) => [...prev, num]);
    setPicking({ kind: "bench", key: String(num) });
  };

  const otherLineups = Object.values(team.lineups)
    .filter((l) => l.lineupId !== lineup.lineupId)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const applyTemplate = (sourceId: string) => {
    const source = otherLineups.find((l) => l.lineupId === sourceId);
    if (!source) return;
    setSlots(lineupSlots(source));
    setBenchOrder(Object.keys(source.bench).map(Number).sort((a, b) => a - b));
    toast.success(`Alineación "${source.name || "sin nombre"}" copiada — revisa y guarda.`);
  };

  const save = async () => {
    // Nombre actual de cada jugador con cuenta (si se renombró, se guarda el nuevo).
    const withNames: LineupSlots = {
      starters: Object.fromEntries(Object.entries(slots.starters).map(([k, s]) => [k, { ...s, name: displayName(s) }])),
      bench: Object.fromEntries(Object.entries(slots.bench).map(([k, s]) => [k, { ...s, name: displayName(s) }])),
    };
    const duplicate = findDuplicateSlot(withNames);
    if (duplicate) {
      toast.error(`"${duplicate}" está en más de un puesto`);
      return;
    }
    setSaving(true);
    try {
      await updateLineup(team.teamname!, lineup.lineupId!, { name, ...slotsToStored(withNames) });
      toast.success("Alineación guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la alineación");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteLineup(team.teamname!, lineup.lineupId!);
      toast.success("Alineación eliminada");
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar la alineación");
    }
  };

  const filled = Object.keys(slots.starters).length;

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
                  {l.name || "(sin nombre)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Titulares</p>
          <p className="text-xs text-muted-foreground">{filled} de 15 · toca un puesto</p>
        </div>
        <LineupPitch
          slots={pitchSlots}
          selected={picking?.kind === "starters" ? Number(picking.key) : null}
          onSelect={(pos) => setPicking({ kind: "starters", key: String(pos) })}
        />
        <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-destructive" /> Lesionado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-warning" /> Fuera de sus puestos
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Suplentes</p>
        <div className="flex flex-wrap gap-2">
          {benchOrder.map((num) => {
            const slot = slots.bench[String(num)];
            return (
              <span key={num} className="inline-flex items-center rounded-lg border">
                <button
                  type="button"
                  onClick={() => setPicking({ kind: "bench", key: String(num) })}
                  className="flex items-center gap-2 py-1.5 pr-1 pl-2.5 text-sm hover:text-foreground"
                >
                  <span className="text-xs font-semibold text-muted-foreground">{num}</span>
                  <span className={cn("max-w-36 truncate", !slot && "text-muted-foreground")}>
                    {displayName(slot) || "Elegir…"}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar suplente ${num}`}
                  onClick={() => removeBenchSlot(num)}
                >
                  <X className="size-3.5" />
                </Button>
              </span>
            );
          })}
          <Button type="button" variant="outline" size="sm" onClick={addBenchSlot}>
            <Plus className="size-3.5" /> Añadir suplente
          </Button>
        </div>
      </div>

      <Button size="xl" className="w-full" disabled={saving} onClick={() => void save()}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>

      <ConfirmDialog
        trigger={
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive">
            <Trash2 className="size-4" /> Eliminar alineación
          </Button>
        }
        title={`¿Eliminar "${name || "esta alineación"}"?`}
        description={
          assignedFechas.length > 0
            ? `Está asignada a ${assignedFechas.length === 1 ? `el partido del ${assignedFechas[0]}` : `${assignedFechas.length} partidos`} — se quedará${assignedFechas.length === 1 ? "" : "n"} sin alineación asignada.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={remove}
      />

      {picking && (
        <SlotPicker
          key={`${picking.kind}-${picking.key}`}
          target={picking}
          candidates={candidates}
          where={where}
          current={slots[picking.kind][picking.key]}
          squad={squadSet}
          onPick={(slot) => pick(picking, slot)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
