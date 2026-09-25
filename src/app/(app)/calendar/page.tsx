"use client";

import { CalendarDays, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { DayPanel } from "@/components/calendar/DayPanel";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { UpcomingEvents } from "@/components/calendar/UpcomingEvents";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { CalendarSkeleton } from "@/components/skeletons";
import { JoinTeamForm } from "@/components/team/JoinTeamForm";
import { Button } from "@/components/ui/button";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import { useTeam } from "@/hooks/useTeam";
import { setAttendance } from "@/lib/actions/team";
import { attendedDatesFromTeam } from "@/lib/attendance";
import { paramToKey, todayKey } from "@/lib/calendar";
import { isTeamCoach } from "@/lib/permissions";
import type { TrainingDay } from "@/lib/types";

function CalendarContent() {
  const { firebaseUser } = useAuth();
  const { team, hasTeam, loading } = useTeam();
  const searchParams = useSearchParams();

  // Deep-link desde una notificación (?date=dd-MM-yyyy, guiones para no
  // escapar barras): posiciona el mes y selecciona el día directamente.
  // Solo se lee al montar (initializer perezoso, no un efecto) — cambios
  // posteriores en la URL no deben resetear la navegación del usuario.
  const [deepLinkFecha] = useState(() => {
    const dateParam = searchParams.get("date");
    return dateParam ? paramToKey(dateParam) : null;
  });
  // ?tab=rollcall (enlace "Pasar lista" del inicio): abre esa pestaña del
  // día enlazado; al elegir otro día vuelve la pestaña por defecto.
  const [deepLinkTab] = useState(() =>
    searchParams.get("tab") === "rollcall" ? ("rollcall" as const) : undefined,
  );

  const now = new Date();
  const [year, setYear] = useState(() =>
    deepLinkFecha ? Number(deepLinkFecha.split("/")[2]) : now.getFullYear(),
  );
  const [month, setMonth] = useState(() =>
    deepLinkFecha ? Number(deepLinkFecha.split("/")[1]) - 1 : now.getMonth(),
  );
  const [selected, setSelected] = useState<string | null>(deepLinkFecha);

  const daysByFecha = useMemo(() => {
    const map = new Map<string, TrainingDay>();
    for (const td of team?.trainingdays ?? []) {
      if (td.fecha) map.set(td.fecha, td);
    }
    return map;
  }, [team]);

  // "Asistí" por equipo (fase 3): del propio calendario del equipo activo,
  // no de profile.assistedTrainingDays (lista plana que mezcla equipos).
  // Rosters por uid (2026-09-04): accepted_players es {uid: true}.
  const myUid = firebaseUser?.uid ?? "";
  const attended = useMemo(
    () => new Set(attendedDatesFromTeam(team, myUid)),
    [team, myUid],
  );

  const stuck = useLoadingTimeout(loading);
  if (loading) {
    if (stuck) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Tarda más de lo normal"
          hint="Puede ser un problema de conexión — vuelve a intentarlo."
          action={<Button onClick={() => location.reload()}>Reintentar</Button>}
        />
      );
    }
    return <CalendarSkeleton />;
  }
  if (!hasTeam || team === null) {
    // Bug real reportado 2026-09-04: este mensaje mandaba a "la app
    // Android" sin ningún botón — para alguien que aterriza aquí sin
    // equipo (p.ej. desde un enlace guardado) se sentía como la app
    // entera bloqueada. El código SÍ funciona desde la web (ver /team) —
    // se ofrece aquí mismo, sin mandar a ningún sitio.
    return (
      <div className="space-y-4">
        <PageHeader title="Calendario" />
        <EmptyState
          icon={CalendarDays}
          title="Sin calendario de equipo"
          hint="Únete a un equipo con el código que te haya dado tu entrenador."
        />
        <JoinTeamForm />
      </div>
    );
  }

  const isCoach = isTeamCoach(team, firebaseUser?.uid);
  const selectedDay = selected ? (daysByFecha.get(selected) ?? null) : null;

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };
  const goToday = () => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
    setSelected(todayKey());
  };

  const submitOwnAttendance = async (day: TrainingDay, status: "accepted" | "declined") => {
    if (!firebaseUser || !day.fecha) return;
    try {
      await setAttendance({
        teamname: team.teamname!,
        fecha: day.fecha,
        playerUid: firebaseUser.uid,
        status,
      });
      toast.success(status === "accepted" ? "Asistencia confirmada" : "Asistencia rechazada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Calendario"
        action={
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
        }
      />

      <MonthGrid
        year={year}
        month={month}
        daysByFecha={daysByFecha}
        attended={attended}
        selected={selected}
        onSelect={setSelected}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onToday={goToday}
      />

      <UpcomingEvents
        team={team}
        isCoach={isCoach}
        myUid={myUid}
        onSelectDay={setSelected}
        onAnswer={(day, status) => void submitOwnAttendance(day, status)}
      />

      {selected && (
        <DayPanel
          key={selected}
          team={team}
          fecha={selected}
          day={selectedDay}
          isCoach={isCoach}
          myUid={myUid}
          initialTab={selected === deepLinkFecha ? deepLinkTab : undefined}
          onAnswer={(status) => selectedDay && void submitOwnAttendance(selectedDay, status)}
        />
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent />
    </Suspense>
  );
}
