// Fuente: _Club.kt del repo Android. Único nodo top-level con push id.
import { z } from "zod";
import { rtdbList } from "./common";

export const ClubSchema = z.object({
  clubId: z.string().nullish(),
  clubname: z.string().nullish(),
  clubcode: z.string().nullish(),
  clubicon: z.string().nullish(),
  adminUserId: z.string().nullish(),
  teams: rtdbList(z.string()).default([]), // teamnames
});
