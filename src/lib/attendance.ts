// Puerto puro (sin Firebase) de _Team.calculateStreak/calculateMaxStreak —
// reutiliza parseKey de lib/calendar.ts para el parseo "dd/MM/yyyy" (mismo
// criterio que el calendario ya migrado).
import { parseKey } from "./calendar";
import type { Team, TrainingDay } from "./types";

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
 * Fechas ("dd/MM/yyyy") de los días de ESTE equipo en los que el jugador
 * confirmó asistencia — la fuente de verdad por equipo (varios equipos, fase
 * 3, 2026-09-04). Sustituye a Users/{uid}/assistedTrainingDays en la web:
 * esa lista es plana, sin equipo, y con varios equipos mezcla fechas de
 * todos (Android sigue escribiéndola y leyéndola; la web ya no la lee).
 * Sirve tal cual como segundo argumento de calculateStreak/MaxStreak/Rate.
 */
export function attendedDatesFromTeam(team: Team | null | undefined, playerName: string): string[] {
  if (!team || !playerName) return [];
  return team.trainingdays
    .filter((d) => d.fecha && d.accepted_players.includes(playerName))
    .map((d) => d.fecha!);
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

// ── Informe de asistencia por equipo (filtrable por rango de fechas) ──
// A diferencia de calculate*/arriba (histórico completo, por jugador vía
// assistedTrainingDays), esto se calcula directamente sobre
// team.trainingdays[].accepted_players/declined_players — sin necesidad de
// leer el perfil de cada jugador. Pensado para una vista de coach (ver
// TeamAttendance en app/(app)/team/attendance).

export type DateRange = { from?: Date; to?: Date };

/**
 * Sesiones del equipo dentro de un rango, ordenadas cronológicamente. Un
 * `to` ausente se resuelve a `now` (igual criterio que calculateAttendanceRate:
 * las sesiones futuras programadas no cuentan todavía) — un `from` ausente
 * no acota por abajo ("toda la temporada").
 */
export function sessionsInRange(team: Team, range: DateRange, now = new Date()): TrainingDay[] {
  const toMs = (range.to ?? now).getTime();
  const fromMs = range.from?.getTime();
  return team.trainingdays
    .map((d) => ({ d, ms: d.fecha ? parseKey(d.fecha)?.getTime() : undefined }))
    .filter((x): x is { d: TrainingDay; ms: number } => x.ms != null)
    .filter(({ ms }) => ms <= toMs && (fromMs == null || ms >= fromMs))
    .sort((a, b) => a.ms - b.ms)
    .map(({ d }) => d);
}

export type PlayerAttendanceSummary = {
  name: string;
  attended: number;
  total: number;
  /** 0-100, siempre 0 (nunca NaN) cuando total es 0. */
  rate: number;
  /** Sesiones consecutivas asistidas contando desde la última del rango. */
  streak: number;
};

/** Resumen de asistencia por jugador dentro de un rango — un total distinto de 0 significa que hay sesiones en el rango (igual para todos los jugadores). */
export function attendanceSummaryByPlayer(
  team: Team,
  range: DateRange,
  now = new Date(),
): PlayerAttendanceSummary[] {
  const sessions = sessionsInRange(team, range, now);
  const total = sessions.length;
  return team.userplayers.map((name) => {
    const attended = sessions.filter((s) => s.accepted_players.includes(name)).length;
    let streak = 0;
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].accepted_players.includes(name)) streak++;
      else break;
    }
    return {
      name,
      attended,
      total,
      rate: total === 0 ? 0 : Math.round((attended / total) * 100),
      streak,
    };
  });
}

export type PlayerAttendanceDetail = {
  fecha: string;
  nameTrainingDay: string | null | undefined;
  eventType: "TRAINING" | "MATCH" | null | undefined;
  status: "accepted" | "declined" | "none";
};

/** Desglose día a día de un jugador dentro de un rango (para el detalle desplegable del informe). */
export function attendanceDetailForPlayer(
  team: Team,
  name: string,
  range: DateRange,
  now = new Date(),
): PlayerAttendanceDetail[] {
  return sessionsInRange(team, range, now).map((s) => ({
    fecha: s.fecha!,
    nameTrainingDay: s.nameTrainingDay,
    eventType: s.eventType,
    status: s.accepted_players.includes(name)
      ? "accepted"
      : s.declined_players.includes(name)
        ? "declined"
        : "none",
  }));
}

function startOfWeekMonday(d: Date): Date {
  const dayIdx = d.getDay(); // 0=domingo..6=sábado
  const diffFromMonday = (dayIdx + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffFromMonday);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function previousMonthRange(d: Date): { from: Date; to: Date } {
  return {
    from: new Date(d.getFullYear(), d.getMonth() - 1, 1),
    to: new Date(d.getFullYear(), d.getMonth(), 0), // día 0 del mes actual = último día del anterior
  };
}

export type AttendancePreset = "week" | "month" | "lastMonth" | "all";

export const ATTENDANCE_PRESET_LABELS: Record<AttendancePreset, string> = {
  week: "Esta semana",
  month: "Este mes",
  lastMonth: "Mes pasado",
  all: "Toda la temporada",
};

/** Traduce un preset de UI a un DateRange concreto — pura y testeable por separado de los componentes. */
export function presetRange(preset: AttendancePreset, now = new Date()): DateRange {
  switch (preset) {
    case "week":
      return { from: startOfWeekMonday(now) };
    case "month":
      return { from: startOfMonth(now) };
    case "lastMonth":
      return previousMonthRange(now);
    case "all":
      return {};
  }
}
