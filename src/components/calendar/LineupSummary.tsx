import { RUGBY_POSITIONS, STARTER_POSITIONS } from "@/lib/lineup";
import type { LineupDoc } from "@/lib/types";

/**
 * Alineación de solo lectura — usada tanto en DayPanel (jugador, día
 * seleccionado en el calendario) como en /team/lineups (vista agregada de
 * partidos publicados). Solo se llama cuando ya está publicada.
 */
export function LineupSummary({ lineup }: { lineup: LineupDoc }) {
  const starters = STARTER_POSITIONS.map((pos) => [pos, lineup.starters[String(pos)]] as const).filter(
    ([, name]) => name,
  );
  const bench = Object.entries(lineup.bench)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);

  if (starters.length === 0 && bench.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-medium">Alineación</p>
      <div className="space-y-1 text-sm">
        {starters.map(([pos, name]) => (
          <div key={pos} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {pos}. {RUGBY_POSITIONS[pos]}
            </span>
            <span className="font-medium">{name}</span>
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground">Suplentes</p>
          <div className="space-y-1 text-sm">
            {bench.map(([num, name]) => (
              <div key={num} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{num}</span>
                <span className="font-medium">{name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
