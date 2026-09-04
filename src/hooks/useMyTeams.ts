"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { UserTeamsSchema } from "@/lib/schemas/user";

// Referencia estable para "sin equipos": nunca devolver un `[]` literal desde
// un hook — un consumidor que lo ponga en dependencias entraría en bucle
// (bug real en TeamManager/usePlayerStats, 2026-09-04).
const NO_TEAMS: readonly string[] = [];

/**
 * TODOS los equipos a los que pertenece el usuario actual (UserTeams/{uid},
 * varios equipos — fase 1, 2026-09-04), en tiempo real y ordenados por
 * nombre. Distinto de useTeam(), que sigue resolviendo solo el equipo ACTIVO
 * (Users/{uid}/teamname). En la fase 1 ninguna pantalla lo consume todavía:
 * es la API de lectura del futuro selector de equipo. Mismo patrón que
 * useMyClubId(): el estado guarda el uid para no mostrar los equipos de la
 * sesión anterior mientras llega la primera lectura.
 */
export function useMyTeams() {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const [state, setState] = useState<{ uid: string; teams: string[] } | undefined>(undefined);

  useEffect(() => {
    if (!uid) return;
    return onValue(
      ref(db, `${PATHS.USER_TEAMS}/${uid}`),
      (snap) => {
        const map = snap.exists()
          ? parseOr(UserTeamsSchema, snap.val(), `UserTeams/${uid}`)
          : {};
        setState({
          uid,
          teams: Object.keys(map ?? {}).sort((a, b) => a.localeCompare(b, "es")),
        });
      },
      (error) => {
        console.error("useMyTeams:", error);
        setState({ uid, teams: [] });
      },
    );
  }, [uid]);

  // undefined = cargando; sin sesión no hay equipos (derivado, no seteado).
  const teams = !uid ? NO_TEAMS : state?.uid === uid ? state.teams : undefined;
  const loading = profile === null || teams === undefined;
  return { teams: teams ?? NO_TEAMS, loading };
}
