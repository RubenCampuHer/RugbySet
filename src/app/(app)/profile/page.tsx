"use client";

import { Camera, ClipboardCheck, Flame, LogOut, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarInitials } from "@/components/AvatarInitials";
import { PageHeader } from "@/components/PageHeader";
import { RenamePersonDialog } from "@/components/RenamePersonDialog";
import { ProfileSkeleton } from "@/components/skeletons";
import { AttendanceComparisonCard } from "@/components/stats/AttendanceComparisonCard";
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
import { updateOwnPhoto } from "@/lib/actions/profile";
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
  const { firebaseUser, profile, logout } = useAuth();
  const { team } = useTeam();
  const { teams: myTeams } = useMyTeams();
  const router = useRouter();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (profile === null) {
    return <ProfileSkeleton />;
  }

  const uploadPhoto = async (file: File) => {
    if (!firebaseUser) return;
    setUploadingPhoto(true);
    try {
      await updateOwnPhoto(firebaseUser.uid, file);
      toast.success("Foto actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Asistencia del equipo ACTIVO, derivada de su propio calendario (fase 3):
  // profile.assistedTrainingDays es una lista plana que mezcla equipos.
  const attendedDates = attendedDatesFromTeam(team, firebaseUser?.uid ?? "");
  const myUid = firebaseUser?.uid;
  const streak = team ? calculateStreak(team, attendedDates, undefined, myUid) : 0;
  const maxStreak = team ? calculateMaxStreak(team, attendedDates, undefined, myUid) : 0;
  const rate = team ? calculateAttendanceRate(team, attendedDates, undefined, myUid) : 0;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Perfil" />
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="relative">
            <AvatarInitials
              name={profile.nameSurname}
              src={profile.usericon}
              className="size-16"
              fallbackClassName="text-lg"
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadPhoto(file);
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              className="absolute -right-1 -bottom-1 rounded-full"
              aria-label="Cambiar foto de perfil"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera className="size-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <div>
              <CardTitle>{profile.nameSurname ?? "Sin nombre"}</CardTitle>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
            {firebaseUser && (
              <RenamePersonDialog uid={firebaseUser.uid} currentName={profile.nameSurname ?? ""} />
            )}
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

      {team && firebaseUser && team.userplayers[firebaseUser.uid] === true && (
        <AttendanceComparisonCard team={team} uid={firebaseUser.uid} />
      )}

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
