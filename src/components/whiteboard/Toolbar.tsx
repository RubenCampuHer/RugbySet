import {
  ArrowRight,
  Circle,
  Eraser,
  MousePointer2,
  Redo2,
  SendHorizontal,
  Shield,
  Trash2,
  Triangle,
  Undo2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tool } from "./types";

const OBJECT_TOOLS: { tool: Tool; label: string; icon: React.ReactNode }[] = [
  { tool: "select", label: "Seleccionar", icon: <MousePointer2 /> },
  { tool: "player-attack", label: "Atacante", icon: <User className="text-red-500" /> },
  { tool: "player-defense", label: "Defensor", icon: <User className="text-blue-500" /> },
  { tool: "cone", label: "Cono", icon: <Triangle className="text-orange-500" /> },
  { tool: "shield", label: "Escudo", icon: <Shield className="text-slate-500" /> },
  { tool: "ball", label: "Balón", icon: <Circle className="text-amber-800" /> },
  { tool: "arrow-run", label: "Carrera", icon: <ArrowRight /> },
  { tool: "arrow-pass", label: "Pase", icon: <SendHorizontal /> },
  { tool: "line", label: "Línea", icon: <div className="h-0.5 w-4 bg-current" /> },
];

export function Toolbar({
  tool,
  onToolChange,
  canDelete,
  onDelete,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onClear,
}: {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  canDelete: boolean;
  onDelete: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
      <div className="flex flex-wrap gap-1">
        {OBJECT_TOOLS.map(({ tool: t, label, icon }) => (
          <Button
            key={t}
            type="button"
            variant={tool === t ? "default" : "outline"}
            size="sm"
            aria-pressed={tool === t}
            className={cn("gap-1.5", tool === t && "ring-2 ring-ring/50")}
            onClick={() => onToolChange(t)}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>
      <div className="ml-auto flex flex-wrap gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Deshacer"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Rehacer"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Borrar seleccionado"
          disabled={!canDelete}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Limpiar todo" onClick={onClear}>
          <Eraser />
        </Button>
      </div>
    </div>
  );
}
