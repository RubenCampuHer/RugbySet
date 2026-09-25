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

/**
 * Días que cuentan para asistencia: todos salvo los cancelados (2026-09-23,
 * TrainingDay.cancelled, solo web). Un evento cancelado sigue en el
 * calendario pero no penaliza a nadie.
 */
export function countableDays(team: Team): TrainingDay[] {
  return team.trainingdays.filter((d) => d.cancelled !== true);
}

/** Asistencia real al pasar lista (paso 2 Kanteo, 2026-09-25): Teams/{t}/eventData/{yyyy-MM-dd}/attendance/{uid}. */
export const ATTENDANCE_MARKS = ["present", "late", "absent", "injured", "excused"] as const;
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export const ATTENDANCE_MARK_LABEL: Record<AttendanceMark, string> = {
  present: "Presente",
  late: "Tarde",
  absent: "Faltó",
  injured: "Lesionado",
  excused: "Justificado",
};

/** "dd/MM/yyyy" → "yyyy-MM-dd", clave de eventData (las claves RTDB no admiten "/"). */
export function eventDataKey(fecha: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Marca real de un jugador en un día, si la hay (valores desconocidos se ignoran). */
export function attendanceMark(team: Team, day: TrainingDay, uid: string): AttendanceMark | undefined {
  const key = day.fecha ? eventDataKey(day.fecha) : null;
  const value = key ? team.eventData[key]?.attendance[uid] : undefined;
  return (ATTENDANCE_MARKS as readonly string[]).includes(value ?? "") ? (value as AttendanceMark) : undefined;
}

/**
 * Cómo cuenta un día para un jugador — mismo criterio que
 * functions/attendance.js del repo Android (mantener en sincronía): con marca
 * real manda la marca ("late" = asistió; "injured"/"excused" = ese día no
 * cuenta para él); sin marca, su respuesta (accepted_players), que es donde
 * Android sigue pasando lista.
 */
export function dayOutcome(team: Team, day: TrainingDay, uid: string): "attended" | "missed" | "excluded" {
  const mark = attendanceMark(team, day, uid);
  if (mark === "injured" || mark === "excused") return "excluded";
  if (mark) return mark === "present" || mark === "late" ? "attended" : "missed";
  return day.accepted_players[uid] === true ? "attended" : "missed";
}

function teamTrainingDates(team: Team, now: Date, uid?: string): number[] {
  const days = countableDays(team).filter((d) => !uid || dayOutcome(team, d, uid) !== "excluded");
  return pastDateKeys(days.map((d) => d.fecha), now);
}

/**
 * Fechas ("dd/MM/yyyy") de los días de ESTE equipo en los que el jugador
 * confirmó asistencia — la fuente de verdad por equipo (varios equipos, fase
 * 3, 2026-09-04). Sustituye a Users/{uid}/assistedTrainingDays en la web:
 * esa lista es plana, sin equipo, y con varios equipos mezcla fechas de
 * todos (Android sigue escribiéndola y leyéndola; la web ya no la lee).
 * Sirve tal cual como segundo argumento de calculateStreak/MaxStreak/Rate.
 * Rosters por uid (2026-09-04): accepted_players es {uid: true}, no una
 * lista de nombres — recibe uid, no nameSurname.
 */
export function attendedDatesFromTeam(team: Team | null | undefined, uid: string): string[] {
  if (!team || !uid) return [];
  return countableDays(team)
    .filter((d) => d.fecha && dayOutcome(team, d, uid) === "attended")
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
  /** Con uid, los días en que ese jugador estaba lesionado/justificado no cuentan. */
  uid?: string,
): number {
  const teamDates = teamTrainingDates(team, now, uid);
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
  /** Con uid, los días en que ese jugador estaba lesionado/justificado no cuentan. */
  uid?: string,
): number {
  const teamDates = teamTrainingDates(team, now, uid);
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
  /** Con uid, los días en que ese jugador estaba lesionado/justificado no cuentan. */
  uid?: string,
): number {
  const teamDates = teamTrainingDates(team, now, uid);
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
  return countableDays(team)
    .map((d) => ({ d, ms: d.fecha ? parseKey(d.fecha)?.getTime() : undefined }))
    .filter((x): x is { d: TrainingDay; ms: number } => x.ms != null)
    .filter(({ ms }) => ms <= toMs && (fromMs == null || ms >= fromMs))
    .sort((a, b) => a.ms - b.ms)
    .map(({ d }) => d);
}

export type PlayerAttendanceSummary = {
  /** Rosters por uid (2026-09-04) — el nombre a mostrar se resuelve aparte, vía useProfilesByUid (el llamador no está en Firebase). */
  uid: string;
  attended: number;
  total: number;
  /** 0-100, siempre 0 (nunca NaN) cuando total es 0. */
  rate: number;
  /** Sesiones consecutivas asistidas contando desde la última del rango. */
  streak: number;
};

/** Resumen de asistencia por jugador dentro de un rango — el total puede variar por jugador (sus días lesionado/justificado no cuentan). */
export function attendanceSummaryByPlayer(
  team: Team,
  range: DateRange,
  now = new Date(),
): PlayerAttendanceSummary[] {
  const sessions = sessionsInRange(team, range, now);
  return Object.keys(team.userplayers).map((uid) => {
    const mine = sessions.filter((s) => dayOutcome(team, s, uid) !== "excluded");
    const total = mine.length;
    const attended = mine.filter((s) => dayOutcome(team, s, uid) === "attended").length;
    let streak = 0;
    for (let i = mine.length - 1; i >= 0; i--) {
      if (dayOutcome(team, mine[i], uid) === "attended") streak++;
      else break;
    }
    return {
      uid,
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
  /** Respuesta del jugador (Sí/No). */
  status: "accepted" | "declined" | "none";
  /** Asistencia real si se pasó lista con la web. */
  mark?: AttendanceMark;
};

/** Desglose día a día de un jugador dentro de un rango (para el detalle desplegable del informe). */
export function attendanceDetailForPlayer(
  team: Team,
  uid: string,
  range: DateRange,
  now = new Date(),
): PlayerAttendanceDetail[] {
  return sessionsInRange(team, range, now).map((s) => ({
    fecha: s.fecha!,
    nameTrainingDay: s.nameTrainingDay,
    eventType: s.eventType,
    status: s.accepted_players[uid] === true
      ? "accepted"
      : s.declined_players[uid] === true
        ? "declined"
        : "none",
    mark: attendanceMark(team, s, uid),
  }));
}

export function startOfWeekMonday(d: Date): Date {
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

// ── Comparación del jugador con su equipo (2026-09-23) ──
// Se calcula en cliente sobre team.trainingdays (el jugador ya lee su equipo
// entero): sin lecturas nuevas ni datos de otros equipos. No expone nombres de
// compañeros, solo la media y la posición.

export type TeamComparison = {
  /** % propio (0-100). */
  mine: number;
  /** Media del % de todos los jugadores del equipo, redondeada. */
  teamAverage: number;
  /** Posición del jugador (1 = el que más asiste; empates comparten puesto). */
  rank: number;
  /** Número de jugadores del equipo. */
  size: number;
  /** Sesiones que cuentan en el rango (0 = sin datos todavía). */
  sessions: number;
};

export function teamComparison(
  team: Team,
  uid: string,
  range: DateRange,
  now = new Date(),
): TeamComparison | null {
  const summaries = attendanceSummaryByPlayer(team, range, now);
  const me = summaries.find((s) => s.uid === uid);
  if (!me) return null;
  const size = summaries.length;
  const teamAverage = Math.round(summaries.reduce((sum, s) => sum + s.rate, 0) / size);
  const rank = 1 + summaries.filter((s) => s.rate > me.rate).length;
  return { mine: me.rate, teamAverage, rank, size, sessions: me.total };
}

export type MonthlyAttendance = {
  /** "yyyy-MM" */
  key: string;
  year: number;
  /** 0-11 */
  month: number;
  sessions: number;
  /** % propio del mes; null si no se pasa uid o si ese mes no cuenta para él (lesionado/justificado). */
  mine: number | null;
  /** Media del equipo en el mes. */
  teamAverage: number;
};

/** Serie mensual (solo meses con sesiones) del % propio frente a la media del equipo. */
export function attendanceByMonth(
  team: Team,
  uid: string | null,
  range: DateRange,
  now = new Date(),
): MonthlyAttendance[] {
  const players = Object.keys(team.userplayers);
  const byMonth = new Map<string, TrainingDay[]>();
  for (const s of sessionsInRange(team, range, now)) {
    const date = parseKey(s.fecha!)!;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(s);
    byMonth.set(key, list);
  }
  // null = ese mes no cuenta para él (todo lesionado/justificado).
  const pct = (sessions: TrainingDay[], id: string): number | null => {
    const mine = sessions.filter((s) => dayOutcome(team, s, id) !== "excluded");
    if (mine.length === 0) return null;
    return Math.round((mine.filter((s) => dayOutcome(team, s, id) === "attended").length / mine.length) * 100);
  };
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, sessions]) => {
      const [y, m] = key.split("-").map(Number);
      const rates = players.map((p) => pct(sessions, p)).filter((r): r is number => r !== null);
      const teamAverage = rates.length === 0 ? 0 : Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
      return {
        key,
        year: y,
        month: m - 1,
        sessions: sessions.length,
        mine: uid ? pct(sessions, uid) : null,
        teamAverage,
      };
    });
}
