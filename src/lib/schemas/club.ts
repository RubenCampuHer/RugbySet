// Fuente: _Club.kt del repo Android. Único nodo top-level con push id.
import { z } from "zod";
import { rtdbList, rtdbRecord } from "./common";

export const ClubSchema = z.object({
  clubId: z.string().nullish(),
  clubname: z.string().nullish(),
  clubcode: z.string().nullish(),
  clubicon: z.string().nullish(),
  adminUserId: z.string().nullish(), // uid del fundador — sigue siendo "el dueño" (único que puede quitar a un co-director)
  teams: rtdbList(z.string()).default([]), // teamnames
  // Equipos que han pedido unirse al club y esperan que el admin los
  // apruebe/rechace — MAPA {teamname: true}, no array (Aditivo 2026-08-21).
  // Tiene que ser mapa: database.rules.json valida la aprobación
  // comprobando root.child('Clubs')...child('pendingTeams').child(teamname)
  // — las reglas RTDB no tienen "array contains", así que un array no
  // permitiría exigir que existiera una solicitud real antes de aprobar.
  pendingTeams: z.record(z.string(), z.boolean()).catch({}),
  // Varios directores por club (rediseño 2026-09-03, mismo patrón que
  // Team.coaches): mapa uid->true, no array. Sin "pendingDirectors" — el
  // nombramiento es directo por otro director (mirror de promoteToCoach),
  // no autoservicio con aprobación.
  directors: rtdbRecord(z.literal(true)).default({}),
});
