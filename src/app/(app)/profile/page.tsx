"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { getRoleDisplayName } from "@/lib/permissions";

export default function ProfilePage() {
  const { profile } = useAuth();

  if (profile === null) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Perfil</h1>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={profile.usericon ?? undefined} />
            <AvatarFallback>
              {(profile.nameSurname ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
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
    </div>
  );
}
