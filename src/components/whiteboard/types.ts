// Estado de la pizarra táctica. Se serializa a JSON y se guarda en
// Exercise.boardData (espejo del campo boardData de _Exercise.kt, que
// Android preserva pero no interpreta — la pizarra es solo web).
import { z } from "zod";

export type Vec = { x: number; y: number };

const VecSchema = z.object({ x: z.number(), y: z.number() });

export type Team = "attack" | "defense";
export type ArrowStyle = "run" | "pass";

export type PlayerObject = {
  id: string;
  kind: "player";
  team: Team;
  pos: Vec;
  number?: number;
};

export type PointObject = {
  id: string;
  kind: "cone" | "shield" | "ball";
  pos: Vec;
};

export type ArrowObject = {
  id: string;
  kind: "arrow";
  style: ArrowStyle;
  from: Vec;
  to: Vec;
  /** Punto de control (Bézier cuadrática). Ausente = recta. */
  ctrl?: Vec;
};

export type LineObject = {
  id: string;
  kind: "line";
  from: Vec;
  to: Vec;
  /** Punto de control (Bézier cuadrática). Ausente = recta. */
  ctrl?: Vec;
};

/** Flecha o línea: los dos objetos con extremos `from`/`to`. */
export type SegmentObject = ArrowObject | LineObject;

export type BoardObject = PlayerObject | PointObject | ArrowObject | LineObject;

export type BoardState = {
  version: 1;
  objects: BoardObject[];
};

export type Tool =
  | "select"
  | "player-attack"
  | "player-defense"
  | "cone"
  | "shield"
  | "ball"
  | "arrow-run"
  | "arrow-pass"
  | "line";

const PlayerSchema = z.object({
  id: z.string(),
  kind: z.literal("player"),
  team: z.enum(["attack", "defense"]),
  pos: VecSchema,
  number: z.number().int().optional(),
});

const PointSchema = z.object({
  id: z.string(),
  kind: z.enum(["cone", "shield", "ball"]),
  pos: VecSchema,
});

const ArrowSchema = z.object({
  id: z.string(),
  kind: z.literal("arrow"),
  style: z.enum(["run", "pass"]),
  from: VecSchema,
  to: VecSchema,
  ctrl: VecSchema.optional(),
});

const LineSchema = z.object({
  id: z.string(),
  kind: z.literal("line"),
  from: VecSchema,
  to: VecSchema,
  ctrl: VecSchema.optional(),
});

export const BoardObjectSchema = z.discriminatedUnion("kind", [
  PlayerSchema,
  PointSchema,
  ArrowSchema,
  LineSchema,
]);

export const BoardStateSchema = z.object({
  version: z.literal(1),
  objects: z.array(BoardObjectSchema),
});

/** Ancho×alto del viewBox — 16:9, igual que el aspect-video de las cards. */
export const BOARD_WIDTH = 1600;
export const BOARD_HEIGHT = 900;

export const EMPTY_BOARD: BoardState = { version: 1, objects: [] };

/**
 * Distancia mínima (en coords de board) para que un arrastre cree flecha/línea,
 * y umbral bajo el cual una curva vuelve a ser recta.
 */
export const MIN_DRAG_DISTANCE = 12;

/** Nunca lanza — un boardData corrupto o de una versión futura abre la pizarra vacía. */
export function parseBoardData(raw: string | null | undefined): BoardState {
  if (!raw) return EMPTY_BOARD;
  try {
    const json: unknown = JSON.parse(raw);
    const result = BoardStateSchema.safeParse(json);
    return result.success ? result.data : EMPTY_BOARD;
  } catch {
    return EMPTY_BOARD;
  }
}

export function serializeBoardData(state: BoardState): string {
  return JSON.stringify(state);
}

let nextId = 0;
/** IDs únicos por sesión de editor — no se persisten como claves RTDB. */
export function newObjectId(): string {
  nextId += 1;
  return `obj-${Date.now()}-${nextId}`;
}
