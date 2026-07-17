import type { PointerEvent as ReactPointerEvent } from "react";
import type { BoardObject } from "./types";

const ATTACK_COLOR = "#ef4444";
const DEFENSE_COLOR = "#3b82f6";
const CONE_COLOR = "#f97316";
const SHIELD_COLOR = "#334155";
const BALL_COLOR = "#78350f";
const SELECTED_RING = "#facc15";

export const PLAYER_RADIUS = 28;
export const HANDLE_RADIUS = 14;

type Endpoint = "from" | "to";

type Handlers = {
  onBodyPointerDown?: (e: ReactPointerEvent<SVGElement>) => void;
  onEndpointPointerDown?: (endpoint: Endpoint) => (e: ReactPointerEvent<SVGElement>) => void;
};

/** Renderiza un único objeto de la pizarra. interactive=false para el export (sin selección/handles). */
export function BoardObjectShape({
  object,
  selected,
  interactive,
  onBodyPointerDown,
  onEndpointPointerDown,
}: { object: BoardObject; selected: boolean; interactive: boolean } & Handlers) {
  const ring = interactive && selected ? (
    <RingFor object={object} />
  ) : null;

  switch (object.kind) {
    case "player": {
      const color = object.team === "attack" ? ATTACK_COLOR : DEFENSE_COLOR;
      return (
        <g onPointerDown={onBodyPointerDown} style={{ cursor: interactive ? "grab" : undefined }}>
          {ring}
          <circle cx={object.pos.x} cy={object.pos.y} r={PLAYER_RADIUS} fill={color} stroke="white" strokeWidth={3} />
          {object.number != null && (
            <text
              x={object.pos.x}
              y={object.pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={24}
              fontWeight={700}
              fontFamily="system-ui, sans-serif"
            >
              {object.number}
            </text>
          )}
        </g>
      );
    }

    case "cone": {
      const { x, y } = object.pos;
      const s = 22;
      return (
        <g onPointerDown={onBodyPointerDown} style={{ cursor: interactive ? "grab" : undefined }}>
          {ring}
          <polygon
            points={`${x},${y - s} ${x - s},${y + s} ${x + s},${y + s}`}
            fill={CONE_COLOR}
            stroke="white"
            strokeWidth={2}
          />
        </g>
      );
    }

    case "shield": {
      const { x, y } = object.pos;
      const w = 54;
      const h = 32;
      return (
        <g onPointerDown={onBodyPointerDown} style={{ cursor: interactive ? "grab" : undefined }}>
          {ring}
          <rect
            x={x - w / 2}
            y={y - h / 2}
            width={w}
            height={h}
            rx={6}
            fill={SHIELD_COLOR}
            stroke="white"
            strokeWidth={2}
          />
        </g>
      );
    }

    case "ball": {
      const { x, y } = object.pos;
      return (
        <g onPointerDown={onBodyPointerDown} style={{ cursor: interactive ? "grab" : undefined }}>
          {ring}
          <ellipse cx={x} cy={y} rx={24} ry={15} fill={BALL_COLOR} stroke="white" strokeWidth={2} />
          <line x1={x - 14} y1={y} x2={x + 14} y2={y} stroke="white" strokeWidth={2} />
        </g>
      );
    }

    case "arrow":
    case "line": {
      const isArrow = object.kind === "arrow";
      const dashed = isArrow ? object.style === "pass" : false;
      return (
        <g onPointerDown={onBodyPointerDown} style={{ cursor: interactive ? "grab" : undefined }}>
          <line
            x1={object.from.x}
            y1={object.from.y}
            x2={object.to.x}
            y2={object.to.y}
            stroke={selected && interactive ? SELECTED_RING : "white"}
            strokeWidth={5}
            strokeDasharray={dashed ? "14 10" : undefined}
            markerEnd={isArrow ? "url(#board-arrowhead)" : undefined}
          />
          {interactive && selected && (
            <>
              <circle
                cx={object.from.x}
                cy={object.from.y}
                r={HANDLE_RADIUS}
                fill="white"
                stroke={SELECTED_RING}
                strokeWidth={3}
                style={{ cursor: "grab" }}
                onPointerDown={onEndpointPointerDown?.("from")}
              />
              <circle
                cx={object.to.x}
                cy={object.to.y}
                r={HANDLE_RADIUS}
                fill="white"
                stroke={SELECTED_RING}
                strokeWidth={3}
                style={{ cursor: "grab" }}
                onPointerDown={onEndpointPointerDown?.("to")}
              />
            </>
          )}
        </g>
      );
    }
  }
}

function RingFor({ object }: { object: BoardObject }) {
  if (object.kind === "arrow" || object.kind === "line") return null;
  const r =
    object.kind === "player"
      ? PLAYER_RADIUS + 6
      : object.kind === "ball"
        ? 30
        : 34;
  return (
    <circle
      cx={object.pos.x}
      cy={object.pos.y}
      r={r}
      fill="none"
      stroke={SELECTED_RING}
      strokeWidth={3}
      strokeDasharray="6 4"
    />
  );
}

/** Definición del marker de flecha — se monta una vez en <defs> del BoardSvg. */
export function ArrowheadMarker() {
  return (
    <marker
      id="board-arrowhead"
      viewBox="0 0 10 10"
      refX={8}
      refY={5}
      markerWidth={7}
      markerHeight={7}
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 Z" fill="white" />
    </marker>
  );
}
