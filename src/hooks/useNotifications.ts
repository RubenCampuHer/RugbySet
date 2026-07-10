"use client";

import { onValue, ref, update } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PATHS } from "@/lib/constants";
import { db } from "@/lib/firebase";
import { parseMapOr } from "@/lib/schemas/common";
import { NotificationSchema } from "@/lib/schemas/user";
import type { Notification } from "@/lib/types";

/**
 * Historial de Users/{yo}/notifications en tiempo real, ordenado por
 * timestamp descendente. markAllAsRead es la única escritura del MVP
 * (nodo propio, permitida por reglas — espejo de
 * NotificationRepository.markAllAsRead).
 */
export function useNotifications() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    const notifRef = ref(db, `${PATHS.USERS}/${uid}/${PATHS.NOTIFICATIONS}`);
    return onValue(
      notifRef,
      (snap) =>
        setItems(
          parseMapOr(NotificationSchema, snap.val(), "notifications").sort(
            (a, b) => b.timestamp - a.timestamp,
          ),
        ),
      (error) => {
        console.error("useNotifications:", error);
        setItems([]);
      },
    );
  }, [uid]);

  const notifications = uid ? (items ?? null) : [];
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  const markAllAsRead = async () => {
    if (!uid || !notifications) return;
    const updates: Record<string, boolean> = {};
    for (const n of notifications) {
      if (!n.read) updates[`${n.id}/read`] = true;
    }
    if (Object.keys(updates).length === 0) return;
    await update(ref(db, `${PATHS.USERS}/${uid}/${PATHS.NOTIFICATIONS}`), updates);
  };

  return {
    notifications: notifications ?? [],
    loading: notifications === null,
    unreadCount,
    markAllAsRead,
  };
}
