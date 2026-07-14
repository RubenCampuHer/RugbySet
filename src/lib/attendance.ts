// Puerto puro (sin Firebase) de _Team.calculateStreak/calculateMaxStreak —
// reutiliza parseKey de lib/calendar.ts para el parseo "dd/MM/yyyy" (mismo
// criterio que el calendario ya migrado).
import { parseKey } from "./calendar";
import type { Team } from "./types";

function pastDateKeys(fechas: (string | null | undefined)[], now: Date): number[] {
  const nowMs = now.getTime();
  return fechas
    .map((f) => (f ? parseKey(f)?.getTime() : undefined))
    .filter((t): t is number => t != null && t <= nowMs)
    .sort((a, b) => a - b);
}

function teamTrainingDates(team: Team, now: Date): number[] {
  return pastDateKeys(team.trainingdays.map((d) => d.fecha), now);
}

/**
 * Racha actual — espejo de _Team.calculateStreak: compara desde el último
 * entreno del equipo hacia atrás cuántos coinciden consecutivamente con los
 * asistidos por el usuario.
 */
export function calculateStreak(
  team: Team,
  assistedTrainingDays: string[],
  now = new Date(),
): number {
  const teamDates = teamTrainingDates(team, now);
  const userDates = pastDateKeys(assistedTrainingDays, now);
  let streak = 0;
  const min = Math.min(teamDates.length, userDates.length);
  for (let i = 1; i <= min; i++) {
    if (teamDates[teamDates.length - i] === userDates[userDates.length - i]) streak++;
    else break;
  }
  return streak;
}

/**
 * Racha máxima histórica — espejo de _Team.calculateMaxStreak: mayor tramo
 * de entrenos consecutivos del equipo a los que asistió.
 */
export function calculateMaxStreak(
  team: Team,
  assistedTrainingDays: string[],
  now = new Date(),
): number {
  const teamDates = teamTrainingDates(team, now);
  const userDates = new Set(pastDateKeys(assistedTrainingDays, now));
  if (teamDates.length === 0 || userDates.size === 0) return 0;

  let max = 0;
  let current = 0;
  for (const date of teamDates) {
    if (userDates.has(date)) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * % de asistencia sobre todos los entrenos pasados del equipo — Android lo
 * calcula sobre un rango de fechas navegable (ReadUser); aquí se simplifica
 * a "todo el histórico" (sin selector de rango, MVP sin gráfico).
 */
export function calculateAttendanceRate(
  team: Team,
  assistedTrainingDays: string[],
  now = new Date(),
): number {
  const teamDates = teamTrainingDates(team, now);
  if (teamDates.length === 0) return 0;
  const userDates = new Set(pastDateKeys(assistedTrainingDays, now));
  const attended = teamDates.filter((d) => userDates.has(d)).length;
  return Math.round((attended / teamDates.length) * 100);
}
