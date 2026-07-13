"use client";

import { ClipboardCheck, LogOut, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarInitials } from "@/components/AvatarInitials";
import { PageHeader } from "@/components/PageHeader";
import { ProfileSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/AuthProvider";
import { getRoleDisplayName, isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, logout } = useAuth();
  const router = useRouter();

  if (profile === null) {
    return <ProfileSkeleton />;
  }

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
          {profile.teamname && <p>Equipo: {profile.teamname}</p>}
          {profile.mail && <p>Email: {profile.mail}</p>}
          <p>Entrenos asistidos: {profile.assistedTrainingDays.length}</p>
        </CardContent>
      </Card>

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
