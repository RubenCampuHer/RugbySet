"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClub } from "@/hooks/useClub";
import { useMyClubId } from "@/hooks/useMyClubId";
import { useTeam } from "@/hooks/useTeam";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import type { Folders, Lessons } from "@/lib/lessons";
import { canWriteClubLessons, isClubDirector } from "@/lib/permissions";
import { type Lesson, LessonFolderSchema, LessonSchema, parseMap } from "@/lib/schemas/lesson";

/**
 * Club cuyas lecciones ve el usuario (2026-09-28) y qué puede hacer: el que
 * dirige (useClub) y, si no dirige ninguno, el de su equipo activo — igual
 * que las reglas de ClubLessons, que miran el equipo ACTIVO.
 */
export function useLessonsClub() {
  const { firebaseUser, profile } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const { club: myClub, loading: loadingMyClub } = useClub();
  const { clubId: memberClubId, loading: loadingMember } = useMyClubId();
  const { team: activeTeam, loading: loadingTeam } = useTeam();
  const clubId = myClub?.clubId ?? memberClubId ?? null;
  // Si soy miembro (no director) cargo ese club para saber su nombre.
  const { club: memberClub } = useClub(myClub ? undefined : memberClubId);
  const club = myClub ?? memberClub ?? null;
  const isDirector = isClubDirector(club, uid, profile);
  const canWrite = canWriteClubLessons({ isDirector, activeTeam, clubId, uid });
  return {
    uid,
    clubId,
    club,
    isDirector,
    canWrite,
    loading: loadingMyClub || loadingMember || loadingTeam || profile === null,
  };
}

/**
 * Elementos del índice (index/{kind}) que el usuario puede leer, en tiempo
 * real (2026-09-28, públicos): el índice solo da ids y cada carpeta/lección se
 * lee aparte; las que las reglas no dejan ver (público de otro equipo, solo
 * entrenadores…) se descartan sin error.
 */
function useIndexed<T>(clubId: string | null, kind: "folders" | "lessons", schema: z.ZodType<T>) {
  const [index, setIndex] = useState<{ clubId: string; ids: string[] } | null>(null);
  const [items, setItems] = useState<Record<string, T | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    return onValue(
      ref(db, `${PATHS.CLUB_LESSONS}/${clubId}/index/${kind}`),
      (snap) => setIndex({ clubId, ids: Object.keys((snap.val() as Record<string, string> | null) ?? {}) }),
      (e) => {
        console.error(`useClubLessons(index/${kind}):`, e);
        setError(e.message);
      },
    );
  }, [clubId, kind]);

  const ids = index && index.clubId === clubId ? index.ids : null;
  const idsKey = ids?.join(",") ?? "";
  useEffect(() => {
    if (!clubId || !idsKey) return;
    const offs = idsKey.split(",").map((id) =>
      onValue(
        ref(db, `${PATHS.CLUB_LESSONS}/${clubId}/${kind}/${id}`),
        (snap) => {
          const parsed = snap.exists() ? schema.safeParse(snap.val()) : null;
          setItems((prev) => ({ ...prev, [id]: parsed?.success ? parsed.data : null }));
        },
        // Sin permiso (público que no me incluye): simplemente no lo veo.
        () => setItems((prev) => ({ ...prev, [id]: null })),
      ),
    );
    return () => offs.forEach((off) => off());
  }, [clubId, kind, idsKey, schema]);

  return useMemo(() => {
    const data: Record<string, T> = {};
    for (const id of ids ?? []) if (items[id]) data[id] = items[id]!;
    const loading = Boolean(clubId) && !error && (!ids || ids.some((id) => !(id in items)));
    return { data, loading, error };
  }, [clubId, ids, items, error]);
}

/** Carpetas y lecciones publicadas del club que el usuario puede ver, en tiempo real. */
export function useClubLessons(clubId: string | null) {
  const folders = useIndexed(clubId, "folders", LessonFolderSchema);
  const lessons = useIndexed(clubId, "lessons", LessonSchema);
  return {
    folders: folders.data as Folders,
    lessons: lessons.data as Lessons,
    loading: folders.loading || lessons.loading,
    error: folders.error ?? lessons.error,
  };
}

/**
 * Versiones pendientes que puede ver el usuario: la dirección, todas
 * (pending/); un entrenador, solo las suyas (índice pendingBy/{uid} + cada
 * pending/{id}, que las reglas le dejan leer por ser el autor).
 */
export function usePendingLessons(clubId: string | null, uid: string | null, isDirector: boolean) {
  // Cada estado recuerda de qué consulta viene: así "cargando" se deriva sin setState en los efectos.
  const [all, setAll] = useState<{ key: string; data: Lessons } | null>(null);
  const [ids, setIds] = useState<{ key: string; ids: string[] } | null>(null);
  const [mine, setMine] = useState<Record<string, Lesson | null>>({});
  const allKey = clubId && isDirector ? clubId : null;
  const idsQueryKey = clubId && uid && !isDirector ? `${clubId}/${uid}` : null;

  useEffect(() => {
    if (!allKey) return;
    return onValue(
      ref(db, `${PATHS.CLUB_LESSONS}/${allKey}/pending`),
      (snap) => setAll({ key: allKey, data: parseMap(LessonSchema, snap.val()) }),
      (e) => {
        console.error("usePendingLessons:", e);
        setAll({ key: allKey, data: {} });
      },
    );
  }, [allKey]);

  useEffect(() => {
    if (!idsQueryKey) return;
    return onValue(
      ref(db, `${PATHS.CLUB_LESSONS}/${clubId}/pendingBy/${uid}`),
      (snap) => setIds({ key: idsQueryKey, ids: Object.keys((snap.val() as Record<string, true> | null) ?? {}) }),
      (e) => {
        console.error("usePendingLessons(pendingBy):", e);
        setIds({ key: idsQueryKey, ids: [] });
      },
    );
  }, [idsQueryKey, clubId, uid]);

  const myIds = ids && ids.key === idsQueryKey ? ids.ids : null;
  const idsKey = myIds?.join(",") ?? "";
  useEffect(() => {
    if (!clubId || isDirector || !idsKey) return;
    const offs = idsKey.split(",").map((id) =>
      onValue(
        ref(db, `${PATHS.CLUB_LESSONS}/${clubId}/pending/${id}`),
        (snap) => {
          const parsed = snap.exists() ? LessonSchema.safeParse(snap.val()) : null;
          // null = cargada pero ya no existe (o no válida).
          setMine((prev) => ({ ...prev, [id]: parsed?.success ? parsed.data : null }));
        },
        (e) => {
          console.error("usePendingLessons(pending):", e);
          setMine((prev) => ({ ...prev, [id]: null }));
        },
      ),
    );
    return () => offs.forEach((off) => off());
  }, [clubId, isDirector, idsKey]);

  return useMemo(() => {
    if (!clubId) return { pending: {} as Lessons, loading: false };
    if (isDirector) {
      const ready = all?.key === allKey;
      return { pending: ready ? all!.data : {}, loading: !ready };
    }
    if (!uid) return { pending: {} as Lessons, loading: false };
    if (!myIds) return { pending: {} as Lessons, loading: true };
    // Solo las que siguen en el índice (una aprobada o rechazada sale de pendingBy).
    const pending: Lessons = {};
    for (const id of myIds) if (mine[id]) pending[id] = mine[id]!;
    return { pending, loading: myIds.some((id) => !(id in mine)) };
  }, [clubId, uid, isDirector, all, allKey, myIds, mine]);
}
