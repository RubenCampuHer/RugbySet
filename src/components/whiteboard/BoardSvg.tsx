import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowheadMarker, BoardObjectShape } from "./BoardObjects";
import { PitchBackground } from "./PitchBackground";
import { BOARD_HEIGHT, BOARD_WIDTH, type ArrowStyle, type BoardObject, type Vec } from "./types";

type Endpoint = "from" | "to";

export type DraftShape =
  | { kind: "arrow"; style: ArrowStyle; from: Vec; to: Vec }
  | { kind: "line"; from: Vec; to: Vec };

export function BoardSvg({
  objects,
  selectedId = null,
  interactive,
  draft = null,
  className,
  onBackgroundPointerDown,
  onObjectPointerDown,
  onEndpointPointerDown,
  onRootPointerMove,
  onRootPointerUp,
  onRootPointerCancel,
}: {
  objects: BoardObject[];
  selectedId?: string | null;
  interactive: boolean;
  draft?: DraftShape | null;
  className?: string;
  onBackgroundPointerDown?: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onObjectPointerDown?: (id: string) => (e: ReactPointerEvent<SVGElement>) => void;
  onEndpointPointerDown?: (id: string, endpoint: Endpoint) => (e: ReactPointerEvent<SVGElement>) => void;
  onRootPointerMove?: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onRootPointerUp?: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onRootPointerCancel?: (e: ReactPointerEvent<SVGSVGElement>) => void;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
      className={className}
      style={interactive ? { touchAction: "none" } : undefined}
      onPointerDown={interactive ? onBackgroundPointerDown : undefined}
      onPointerMove={interactive ? onRootPointerMove : undefined}
      onPointerUp={interactive ? onRootPointerUp : undefined}
      onPointerCancel={interactive ? onRootPointerCancel : undefined}
    >
      <defs>
        <ArrowheadMarker />
      </defs>
      <PitchBackground />
      {objects.map((object) => (
        <BoardObjectShape
          key={object.id}
          object={object}
          selected={interactive && object.id === selectedId}
          interactive={interactive}
          onBodyPointerDown={onObjectPointerDown?.(object.id)}
          onEndpointPointerDown={
            onEndpointPointerDown
              ? (endpoint) => onEndpointPointerDown(object.id, endpoint)
              : undefined
          }
        />
      ))}
      {draft && (
        <line
          x1={draft.from.x}
          y1={draft.from.y}
          x2={draft.to.x}
          y2={draft.to.y}
          stroke="white"
          strokeOpacity={0.6}
          strokeWidth={5}
          strokeDasharray={draft.kind === "line" ? undefined : draft.style === "pass" ? "14 10" : undefined}
          markerEnd={draft.kind === "arrow" ? "url(#board-arrowhead)" : undefined}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

/** Convierte coordenadas de pantalla (clientX/Y) a coordenadas del viewBox del board. */
export function screenToBoardPoint(target: SVGElement, clientX: number, clientY: number): Vec {
  const svg = target.ownerSVGElement ?? (target as unknown as SVGSVGElement);
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}
