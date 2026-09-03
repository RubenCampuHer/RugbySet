"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { ClubSchema } from "@/lib/schemas/club";
import { parseOr } from "@/lib/schemas/common";
import type { Club } from "@/lib/types";

export type NamedClub = { id: string; club: Club };

/**
 * TODOS los clubes, en tiempo real, sin filtrar por el que administro —
 * solo para el panel admin (Clubs ya es de lectura abierta a cualquier
 * autenticado, ver database.rules.json; este hook no comprueba el rol,
 * hazlo en la página que lo use). Mismo patrón que useAllTeams.
 */
export function useAllClubs() {
  const [clubs, setClubs] = useState<NamedClub[] | null>(null);

  useEffect(() => {
    return onValue(
      ref(db, PATHS.CLUBS),
      (snap) => {
        const entries: NamedClub[] = [];
        snap.forEach((child) => {
          const club = child.key ? parseOr(ClubSchema, child.val(), `Clubs/${child.key}`) : null;
          if (child.key && club) {
            entries.push({ id: child.key, club });
          }
          return false;
        });
        setClubs(entries);
      },
      (error) => {
        console.error("useAllClubs:", error);
        setClubs([]);
      },
    );
  }, []);

  return { clubs: clubs ?? [], loading: clubs === null };
}
