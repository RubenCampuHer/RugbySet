// Lógica pura de la agenda y del inicio (2026-09-23): fechas relativas,
// agrupación por semanas y tareas pendientes por rol. Sin Firebase ni React.
import { startOfWeekMonday } from "./attendance";
import { MONTHS, parseKey } from "./calendar";
import type { Team, TrainingDay } from "./types";

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Diferencia en días naturales (b - a), inmune a cambios de hora. */
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" });

/**
 * "hoy", "mañana", "pasado mañana", "dentro de 5 días", "ayer", "hace 3 días"…
 * hasta una semana; más lejos, fecha corta ("jue, 15 oct"). "" si no parsea.
 */
export function relativeDayLabel(fecha: string, now = new Date()): string {
  const date = parseKey(fecha);
  if (!date) return "";
  const diff = dayDiff(now, date);
  if (Math.abs(diff) <= 6) return rtf.format(diff, "day");
  return shortDate.format(date);
}

export type AgendaEntry = { day: TrainingDay; date: Date };

export type AgendaGroup = { key: string; label: string; entries: AgendaEntry[] };

function weekLabel(weekStart: Date, now: Date): string {
  const diff = Math.round(dayDiff(startOfWeekMonday(now), weekStart) / 7);
  if (diff === 0) return "Esta semana";
  if (diff === 1) return "La semana que viene";
  if (diff === -1) return "La semana pasada";
  return `Semana del ${weekStart.getDate()} de ${MONTHS[weekStart.getMonth()].toLowerCase()}`;
}

/**
 * Eventos del equipo desde hoy ("upcoming", orden ascendente) o anteriores a
 * hoy ("past", orden descendente), agrupados por semana (lunes a domingo).
 */
export function agendaGroups(
  team: Team,
  mode: "upcoming" | "past",
  now = new Date(),
): AgendaGroup[] {
  const today = startOfDay(now).getTime();
  const entries = team.trainingdays
    .map((day) => ({ day, date: day.fecha ? parseKey(day.fecha) : null }))
    .filter((e): e is AgendaEntry => e.date !== null)
    .filter((e) => (mode === "upcoming" ? e.date.getTime() >= today : e.date.getTime() < today))
    .sort((a, b) =>
      mode === "upcoming" ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime(),
    );
  const groups: AgendaGroup[] = [];
  for (const entry of entries) {
    const ws = startOfWeekMonday(entry.date);
    const key = String(ws.getTime());
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: weekLabel(ws, now), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

/** Jugadores del equipo que no han respondido (ni sí ni no) a un evento. */
export function noAnswerUids(team: Team, day: TrainingDay): string[] {
  return Object.keys(team.userplayers).filter(
    (uid) => day.accepted_players[uid] !== true && day.declined_players[uid] !== true,
  );
}

export type StaffTask = {
  kind: "unanswered" | "rollcall";
  fecha: string;
  day: TrainingDay;
  count: number;
};

export type StaffHome = { tasks: StaffTask[]; nextMatch: AgendaEntry | null };

/**
 * Pendientes del cuerpo técnico: eventos de los próximos `aheadDays` con
 * jugadores sin responder (para avisar) y eventos de los últimos `behindDays`
 * con jugadores sin marcar (para pasar lista). Los cancelados no cuentan.
 */
export function staffHome(team: Team, now = new Date(), aheadDays = 7, behindDays = 14): StaffHome {
  const tasks: StaffTask[] = [];
  let nextMatch: AgendaEntry | null = null;
  for (const day of team.trainingdays) {
    const date = day.fecha ? parseKey(day.fecha) : null;
    if (!date || day.cancelled === true) continue;
    const diff = dayDiff(now, date);
    const count = noAnswerUids(team, day).length;
    if (diff >= 0 && diff <= aheadDays && count > 0) {
      tasks.push({ kind: "unanswered", fecha: day.fecha!, day, count });
    } else if (diff < 0 && diff >= -behindDays && count > 0) {
      tasks.push({ kind: "rollcall", fecha: day.fecha!, day, count });
    }
    if (day.eventType === "MATCH" && diff >= 0 && (!nextMatch || date < nextMatch.date)) {
      nextMatch = { day, date };
    }
  }
  const ms = (t: StaffTask) => parseKey(t.fecha)!.getTime();
  tasks.sort((a, b) => (a.kind === b.kind ? ms(a) - ms(b) : a.kind === "unanswered" ? -1 : 1));
  return { tasks, nextMatch };
}

/** Eventos de los próximos `aheadDays` a los que el jugador aún no ha respondido. */
export function playerPending(team: Team, uid: string, now = new Date(), aheadDays = 7): AgendaEntry[] {
  return agendaGroups(team, "upcoming", now)
    .flatMap((g) => g.entries)
    .filter(({ day, date }) => {
      const diff = dayDiff(now, date);
      return (
        diff <= aheadDays &&
        day.cancelled !== true &&
        day.accepted_players[uid] !== true &&
        day.declined_players[uid] !== true
      );
    });
}
