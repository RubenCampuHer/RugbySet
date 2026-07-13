"use client";

import { BellOff, CalendarDays, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/useNotifications";
import { keyToParam } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  attendance: "Convocatoria",
  reminder: "Recordatorio",
  general: "Mensaje",
  training_update: "Entreno",
};

// Estos tipos siempre llevan trainingDate → llevan al día en el calendario.
const CALENDAR_TYPES = new Set(["attendance", "reminder", "training_update"]);

function formatTimestamp(ms: number): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export default function NotificationsPage() {
  const { notifications, loading, unreadCount, markAllAsRead, markAsRead } =
    useNotifications();
  const router = useRouter();

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const openNotification = (n: Notification) => {
    if (!n.read) void markAsRead(n.id);
    if (CALENDAR_TYPES.has(n.type) && n.trainingDate) {
      router.push(`/calendar?date=${keyToParam(n.trainingDate)}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Avisos"
        count={unreadCount > 0 ? unreadCount : undefined}
        action={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => void markAllAsRead()}>
              Marcar todo leído
            </Button>
          )
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No tienes avisos"
          hint="Aquí verás convocatorias, recordatorios y mensajes del equipo."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const actionable = CALENDAR_TYPES.has(n.type) && Boolean(n.trainingDate);
            return (
              <Card
                key={n.id}
                className={cn(!n.read && "border-primary/40 bg-primary/5")}
              >
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className="w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <CardContent className="flex items-start gap-2 py-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "flex items-center gap-2 font-medium",
                            !n.read && "font-semibold",
                          )}
                        >
                          {!n.read && (
                            <span
                              className="size-2 shrink-0 rounded-full bg-primary"
                              aria-label="No leído"
                            />
                          )}
                          {n.title}
                        </p>
                        <Badge variant="outline" className="shrink-0">
                          {TYPE_LABEL[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {n.senderUsername && <span>De: {n.senderUsername}</span>}
                        {n.trainingDate && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {n.trainingDate}
                            {n.trainingTime ? ` · ${n.trainingTime}` : ""}
                          </span>
                        )}
                        <span>{formatTimestamp(n.timestamp)}</span>
                      </div>
                    </div>
                    {actionable && (
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    )}
                  </CardContent>
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
