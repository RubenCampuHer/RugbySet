"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BoardSvg, screenToBoardPoint, type DraftShape } from "./BoardSvg";
import { boardToJpegFile } from "./export";
import { Toolbar } from "./Toolbar";
import {
  newObjectId,
  parseBoardData,
  serializeBoardData,
  type BoardObject,
  type Tool,
  type Vec,
} from "./types";

/** Distancia mínima (en coords de board) para que un arrastre cree flecha/línea. */
const MIN_DRAG_DISTANCE = 12;

type Drag =
  | { kind: "draw"; tool: "arrow-run" | "arrow-pass" | "line"; from: Vec }
  | { kind: "move-point"; id: string; startPointer: Vec; startPos: Vec }
  | { kind: "move-segment"; id: string; startPointer: Vec; startFrom: Vec; startTo: Vec }
  | { kind: "endpoint"; id: string; endpoint: "from" | "to" };

export function WhiteboardDialog({
  open,
  onOpenChange,
  initialBoardData,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBoardData: string | null;
  onSave: (result: { file: File; previewUrl: string; boardData: string }) => void;
}) {
  const [objects, setObjects] = useState<BoardObject[]>(
    () => parseBoardData(initialBoardData).objects,
  );
  const [past, setPast] = useState<BoardObject[][]>([]);
  const [future, setFuture] = useState<BoardObject[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<Drag | null>(null);

  // Snapshot pre-cambio para deshacer — llamar ANTES de mutar `objects`.
  const beginChange = () => {
    setPast((p) => [...p, objects]);
    setFuture([]);
  };

  const placeObject = (t: Tool, pos: Vec) => {
    let obj: BoardObject | null = null;
    if (t === "player-attack" || t === "player-defense") {
      const team = t === "player-attack" ? "attack" : "defense";
      const count = objects.filter((o) => o.kind === "player" && o.team === team).length;
      obj = { id: newObjectId(), kind: "player", team, pos, number: count + 1 };
    } else if (t === "cone" || t === "shield" || t === "ball") {
      obj = { id: newObjectId(), kind: t, pos };
    }
    if (!obj) return;
    beginChange();
    setObjects((objs) => [...objs, obj!]);
  };

  const handleBackgroundPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const pos = screenToBoardPoint(e.currentTarget, e.clientX, e.clientY);
    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    if (tool === "arrow-run" || tool === "arrow-pass" || tool === "line") {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { kind: "draw", tool, from: pos };
      setDraft({
        kind: tool === "line" ? "line" : "arrow",
        style: tool === "arrow-pass" ? "pass" : "run",
        from: pos,
        to: pos,
      });
      return;
    }
    placeObject(tool, pos);
  };

  const handleObjectPointerDown = (id: string) => (e: ReactPointerEvent<SVGElement>) => {
    if (tool !== "select") return; // deja burbujear: con herramienta de colocar, coloca ahí encima
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    svg.setPointerCapture(e.pointerId);
    setSelectedId(id);
    beginChange();
    const pos = screenToBoardPoint(e.currentTarget, e.clientX, e.clientY);
    dragRef.current =
      obj.kind === "arrow" || obj.kind === "line"
        ? { kind: "move-segment", id, startPointer: pos, startFrom: obj.from, startTo: obj.to }
        : { kind: "move-point", id, startPointer: pos, startPos: obj.pos };
  };

  const handleEndpointPointerDown =
    (id: string, endpoint: "from" | "to") => (e: ReactPointerEvent<SVGElement>) => {
      if (tool !== "select") return;
      e.stopPropagation();
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      svg.setPointerCapture(e.pointerId);
      beginChange();
      dragRef.current = { kind: "endpoint", id, endpoint };
    };

  const handleRootPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = screenToBoardPoint(e.currentTarget, e.clientX, e.clientY);

    if (drag.kind === "draw") {
      setDraft((prev) => (prev ? { ...prev, to: pos } : prev));
      return;
    }
    if (drag.kind === "move-point") {
      const dx = pos.x - drag.startPointer.x;
      const dy = pos.y - drag.startPointer.y;
      setObjects((objs) =>
        objs.map((o) =>
          o.id === drag.id && "pos" in o
            ? { ...o, pos: { x: drag.startPos.x + dx, y: drag.startPos.y + dy } }
            : o,
        ),
      );
      return;
    }
    if (drag.kind === "move-segment") {
      const dx = pos.x - drag.startPointer.x;
      const dy = pos.y - drag.startPointer.y;
      setObjects((objs) =>
        objs.map((o) =>
          o.id === drag.id && (o.kind === "arrow" || o.kind === "line")
            ? {
                ...o,
                from: { x: drag.startFrom.x + dx, y: drag.startFrom.y + dy },
                to: { x: drag.startTo.x + dx, y: drag.startTo.y + dy },
              }
            : o,
        ),
      );
      return;
    }
    if (drag.kind === "endpoint") {
      setObjects((objs) =>
        objs.map((o) =>
          o.id === drag.id && (o.kind === "arrow" || o.kind === "line")
            ? { ...o, [drag.endpoint]: pos }
            : o,
        ),
      );
    }
  };

  const handleRootPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === "draw") {
      setDraft(null);
      const to = screenToBoardPoint(e.currentTarget, e.clientX, e.clientY);
      const dist = Math.hypot(to.x - drag.from.x, to.y - drag.from.y);
      if (dist < MIN_DRAG_DISTANCE) return;
      const newObj: BoardObject =
        drag.tool === "line"
          ? { id: newObjectId(), kind: "line", from: drag.from, to }
          : { id: newObjectId(), kind: "arrow", style: drag.tool === "arrow-pass" ? "pass" : "run", from: drag.from, to };
      beginChange();
      setObjects((objs) => [...objs, newObj]);
    }
  };

  const handleRootPointerCancel = () => {
    dragRef.current = null;
    setDraft(null);
  };

  const handleUndo = () => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [objects, ...f]);
    setObjects(prev);
    setSelectedId(null);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, objects]);
    setObjects(next);
    setSelectedId(null);
  };

  const handleDelete = () => {
    if (selectedId === null) return;
    beginChange();
    setObjects((objs) => objs.filter((o) => o.id !== selectedId));
    setSelectedId(null);
  };

  const handleClear = () => {
    if (objects.length === 0) return;
    beginChange();
    setObjects([]);
    setSelectedId(null);
  };

  const handleToolChange = (t: Tool) => {
    setTool(t);
    setSelectedId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const file = await boardToJpegFile(objects);
      const previewUrl = URL.createObjectURL(file);
      const boardData = serializeBoardData({ version: 1, objects });
      onSave({ file, previewUrl, boardData });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la pizarra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none p-0 sm:h-[90dvh] sm:w-[95vw] sm:max-w-5xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-heading text-base font-medium">Pizarra táctica</h2>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

        <Toolbar
          tool={tool}
          onToolChange={handleToolChange}
          canDelete={selectedId !== null}
          onDelete={handleDelete}
          canUndo={past.length > 0}
          onUndo={handleUndo}
          canRedo={future.length > 0}
          onRedo={handleRedo}
          onClear={handleClear}
        />

        <div className="flex flex-1 items-center justify-center overflow-auto bg-black/20 p-2">
          <BoardSvg
            objects={objects}
            selectedId={selectedId}
            interactive
            draft={draft}
            className="h-auto max-h-full w-full max-w-full rounded-lg shadow-lg"
            onBackgroundPointerDown={handleBackgroundPointerDown}
            onRootPointerMove={handleRootPointerMove}
            onRootPointerUp={handleRootPointerUp}
            onRootPointerCancel={handleRootPointerCancel}
            onObjectPointerDown={handleObjectPointerDown}
            onEndpointPointerDown={handleEndpointPointerDown}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
