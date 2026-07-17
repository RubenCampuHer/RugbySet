import { BOARD_HEIGHT, BOARD_WIDTH } from "./types";

const IN_GOAL = 90; // ancho de cada ingoal
const LINE_22 = 220; // distancia desde la línea de marca

/** Campo de rugby decorativo — no interactivo, solo referencia visual. */
export function PitchBackground() {
  const fieldStart = IN_GOAL;
  const fieldEnd = BOARD_WIDTH - IN_GOAL;
  const half = BOARD_WIDTH / 2;

  return (
    <g pointerEvents="none">
      <rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#1a7a3c" />
      {/* Ingoals, algo más oscuros */}
      <rect x={0} y={0} width={IN_GOAL} height={BOARD_HEIGHT} fill="#166534" />
      <rect x={fieldEnd} y={0} width={IN_GOAL} height={BOARD_HEIGHT} fill="#166534" />

      {/* Líneas de marca (try lines) */}
      <line x1={fieldStart} y1={0} x2={fieldStart} y2={BOARD_HEIGHT} stroke="white" strokeWidth={4} />
      <line x1={fieldEnd} y1={0} x2={fieldEnd} y2={BOARD_HEIGHT} stroke="white" strokeWidth={4} />

      {/* 22 */}
      <line
        x1={fieldStart + LINE_22}
        y1={0}
        x2={fieldStart + LINE_22}
        y2={BOARD_HEIGHT}
        stroke="white"
        strokeWidth={2}
      />
      <line
        x1={fieldEnd - LINE_22}
        y1={0}
        x2={fieldEnd - LINE_22}
        y2={BOARD_HEIGHT}
        stroke="white"
        strokeWidth={2}
      />

      {/* Medio campo */}
      <line x1={half} y1={0} x2={half} y2={BOARD_HEIGHT} stroke="white" strokeWidth={2} />

      {/* 10m a cada lado del medio, discontinuas */}
      <line
        x1={half - 130}
        y1={0}
        x2={half - 130}
        y2={BOARD_HEIGHT}
        stroke="white"
        strokeWidth={2}
        strokeDasharray="10 10"
      />
      <line
        x1={half + 130}
        y1={0}
        x2={half + 130}
        y2={BOARD_HEIGHT}
        stroke="white"
        strokeWidth={2}
        strokeDasharray="10 10"
      />
    </g>
  );
}
