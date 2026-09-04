"use client";

import { ClipboardCheck, Flame, LogOut, Smartphone, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarInitials } from "@/components/AvatarInitials";
import { PageHeader } from "@/components/PageHeader";
import { ProfileSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyTeams } from "@/hooks/useMyTeams";
import { useTeam } from "@/hooks/useTeam";
import {
  attendedDatesFromTeam,
  calculateAttendanceRate,
  calculateMaxStreak,
  calculateStreak,
} from "@/lib/attendance";
import { getRoleDisplayName, isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Barra de progreso simple (sin librería de gráficos) para el % de asistencia. */
function AttendanceBar({ percent }: { percent: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Asistencia (histórico)</span>
        <span className="font-medium">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, logout } = useAuth();
  const { team } = useTeam();
  const { teams: myTeams } = useMyTeams();
  const router = useRouter();

  if (profile === null) {
    return <ProfileSkeleton />;
  }

  // Asistencia del equipo ACTIVO, derivada de su propio calendario (fase 3):
  // profile.assistedTrainingDays es una lista plana que mezcla equipos.
  const attendedDates = attendedDatesFromTeam(team, profile.nameSurname ?? "");
  const streak = team ? calculateStreak(team, attendedDates) : 0;
  const maxStreak = team ? calculateMaxStreak(team, attendedDates) : 0;
  const rate = team ? calculateAttendanceRate(team, attendedDates) : 0;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Perfil" />
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <AvatarInitials
            name={profile.nameSurname}
            src={profile.usericon}
            className="size-16"
            fallbackClassName="text-lg"
          />
          <div>
            <CardTitle>{profile.nameSurname ?? "Sin nombre"}</CardTitle>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Badge>{getRoleDisplayName(profile.role)}</Badge>
          </p>
          {myTeams.length > 1 ? (
            <p>
              Equipos:{" "}
              {myTeams.map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <span className={t === profile.teamname ? "font-medium" : undefined}>{t}</span>
                  {t === profile.teamname && (
                    <span className="text-muted-foreground"> (activo)</span>
                  )}
                </span>
              ))}
            </p>
          ) : (
            profile.teamname && <p>Equipo: {profile.teamname}</p>
          )}
          {profile.mail && <p>Email: {profile.mail}</p>}
          {team && (
            <p>
              Entrenos asistidos en {team.teamname}: {attendedDates.length}
            </p>
          )}
        </CardContent>
      </Card>

      {team && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asistencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted/50 p-3">
                <Flame className="size-5 shrink-0 text-warning" />
                <div>
                  <p className="text-lg font-bold leading-none">{streak}</p>
                  <p className="text-xs text-muted-foreground">Racha actual</p>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted/50 p-3">
                <Trophy className="size-5 shrink-0 text-warning" />
                <div>
                  <p className="text-lg font-bold leading-none">{maxStreak}</p>
                  <p className="text-xs text-muted-foreground">Racha máxima</p>
                </div>
              </div>
            </div>
            <AttendanceBar percent={rate} />
          </CardContent>
        </Card>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Smartphone className="size-3.5 shrink-0" />
        Tu nombre, foto y equipo se editan desde la app Android.
      </p>

      {/* Como en Android (ReadUser): la cola de aprobación solo para ADMIN */}
      {isAdmin(profile) && (
        <Link
          href="/admin/approvals"
          className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full")}
        >
          <ClipboardCheck className="size-4" /> Cola de aprobación
        </Link>
      )}

      <Button
        variant="outline"
        size="xl"
        className="w-full text-destructive hover:text-destructive"
        onClick={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </div>
  );
}
