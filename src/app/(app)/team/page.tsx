"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/hooks/useTeam";

function PlayerChip({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-3 py-1">
      <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-sm">{name}</span>
    </div>
  );
}

export default function TeamPage() {
  const { team, coach, hasTeam, loading } = useTeam();

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!hasTeam || team === null) {
    return (
      <div className="space-y-2 py-12 text-center">
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-muted-foreground">
          No perteneces a ningún equipo. Únete desde la app Android con el
          código de tu equipo.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={team.teamicon ?? undefined} />
          <AvatarFallback>🏉</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{team.teamname}</h1>
          <div className="flex flex-wrap gap-1">
            {team.category && <Badge variant="outline">{team.category}</Badge>}
            {team.teamcode && (
              <Badge variant="secondary">Código: {team.teamcode}</Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entrenador</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={coach?.usericon ?? undefined} />
            <AvatarFallback>
              {(coach?.nameSurname ?? "E").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{coach?.nameSurname ?? "Entrenador"}</p>
            {coach?.username && (
              <p className="text-sm text-muted-foreground">@{coach.username}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Jugadores ({team.userplayers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {team.userplayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin jugadores.</p>
          ) : (
            team.userplayers.map((name) => <PlayerChip key={name} name={name} />)
          )}
        </CardContent>
      </Card>

      {team.pendingplayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Pendientes ({team.pendingplayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {team.pendingplayers.map((name) => (
              <PlayerChip key={name} name={name} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
