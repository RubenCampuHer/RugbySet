"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  attendance: "Convocatoria",
  reminder: "Recordatorio",
  general: "Mensaje",
  training_update: "Entreno",
};

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
  const { notifications, loading, unreadCount, markAllAsRead } =
    useNotifications();

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Avisos{" "}
          {unreadCount > 0 && <Badge className="align-middle">{unreadCount}</Badge>}
        </h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => void markAllAsRead()}>
            Marcar todo leído
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No tienes avisos.
        </p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={cn(!n.read && "border-primary")}>
              <CardContent className="space-y-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("font-medium", !n.read && "font-semibold")}>
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
                    <span>
                      📅 {n.trainingDate}
                      {n.trainingTime ? ` · ${n.trainingTime}` : ""}
                    </span>
                  )}
                  <span>{formatTimestamp(n.timestamp)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
