"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
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

/** Carpetas y lecciones publicadas del club, en tiempo real. */
export function useClubLessons(clubId: string | null) {
  const [folders, setFolders] = useState<{ clubId: string; data: Folders } | null>(null);
  const [lessons, setLessons] = useState<{ clubId: string; data: Lessons } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    const base = `${PATHS.CLUB_LESSONS}/${clubId}`;
    const fail = (e: Error) => {
      console.error("useClubLessons:", e);
      setError(e.message);
    };
    const offFolders = onValue(
      ref(db, `${base}/folders`),
      (snap) => setFolders({ clubId, data: parseMap(LessonFolderSchema, snap.val()) }),
      fail,
    );
    const offLessons = onValue(
      ref(db, `${base}/lessons`),
      (snap) => setLessons({ clubId, data: parseMap(LessonSchema, snap.val()) }),
      fail,
    );
    return () => {
      offFolders();
      offLessons();
    };
  }, [clubId]);

  const ready = Boolean(clubId && folders?.clubId === clubId && lessons?.clubId === clubId);
  return {
    folders: ready ? folders!.data : {},
    lessons: ready ? lessons!.data : {},
    loading: Boolean(clubId) && !ready && !error,
    error,
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
