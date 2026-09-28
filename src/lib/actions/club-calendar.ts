// Calendario del club (2026-09-28, solo web): la dirección añade un mismo
// evento (torneo, jornada, reunión…) al calendario de varios equipos a la
// vez. Es un día normal en Teams/{t}/trainingdays de cada equipo (la
// dirección del club tiene el mismo acceso que el entrenador, ver reglas de
// Teams/$teamname) con un clubEventId común. Un día = un evento: si el equipo
// ya tiene algo ese día, se salta y se avisa.
import { deleteTrainingDay, mutateTrainingDays } from "@/lib/actions/team";
import { findRawDay, upsertRawDay } from "@/lib/trainingdays";
import type { Team } from "@/lib/types";

export type ClubEventInput = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  eventType: "TRAINING" | "MATCH";
  nameTrainingDay: string;
  location: string | null;
};

export function newClubEventId(): string {
  return `ce_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Añade el evento a cada equipo; devuelve en cuáles se creó y cuáles ya tenían algo ese día. */
export async function createClubEvent(
  teamnames: string[],
  input: ClubEventInput,
  clubEventId: string,
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const teamname of teamnames) {
    let busy = false;
    await mutateTrainingDays(teamname, (days) => {
      if (findRawDay(days, input.fecha)) {
        busy = true;
        return days;
      }
      return upsertRawDay(days, input.fecha, {
        horaInicio: input.horaInicio,
        horaFin: input.horaFin,
        nameTrainingDay: input.nameTrainingDay.trim(),
        training: null,
        eventType: input.eventType,
        location: input.location?.trim() ? input.location.trim() : null,
        clubEventId,
      });
    });
    (busy ? skipped : created).push(teamname);
  }
  return { created, skipped };
}

/** Borra el evento del club de todos los equipos que lo tengan (con su asistencia y datos del día). */
export async function deleteClubEvent(teams: Team[], clubEventId: string): Promise<number> {
  let removed = 0;
  for (const team of teams) {
    for (const day of team.trainingdays) {
      if (day.clubEventId === clubEventId && day.fecha && team.teamname) {
        await deleteTrainingDay(team.teamname, day.fecha);
        removed++;
      }
    }
  }
  return removed;
}
