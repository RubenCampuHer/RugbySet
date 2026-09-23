"use client";

import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  FolderKanban,
  Home,
  LogOut,
  Shield,
  User,
  Users,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { BrandMark } from "@/components/Brand";
import { BrandLoader } from "@/components/BrandLoader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TeamSwitcher } from "@/components/team/TeamSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { useTeam } from "@/hooks/useTeam";
import { isOnboardingDone } from "@/lib/onboarding-flag";
import { isAdmin, isCoach, isTeamCoach } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// 5 destinos como la bottom navigation Material de la app Android. Desde
// 2026-09-23 dependen del rol: el cuerpo técnico tiene sus herramientas y el
// jugador no ve primero una biblioteca que no puede editar. Avisos pasa a la
// campana del header (visible en móvil y escritorio).
const STAFF_NAV = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/trainings", label: "Entrenos", icon: ClipboardList },
  { href: "/exercises", label: "Ejercicios", icon: Dumbbell },
] as const;

const PLAYER_NAV = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/trainings", label: "Entrenos", icon: ClipboardList },
  { href: "/profile", label: "Perfil", icon: User },
] as const;

function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "absolute -top-1 right-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, logout } = useAuth();
  const { unreadCount } = useNotifications();
  // Equipo activo: solo para saber si pertenece a un club (entrada "Club" del
  // menú también para jugadores, 2026-09-07). Misma suscripción que ya abre
  // /team, así que no añade lecturas nuevas en la práctica.
  const { team: activeTeam } = useTeam();
  const router = useRouter();
  const pathname = usePathname();
  // Cuerpo técnico = quien crea contenido (COACH/ADMIN), dirige un club o
  // entrena el equipo activo; el resto ve la navegación de jugador.
  const isStaff =
    isCoach(profile) ||
    isAdmin(profile) ||
    Boolean(profile?.directorOfClubId) ||
    (activeTeam != null && isTeamCoach(activeTeam, firebaseUser?.uid));
  const NAV = isStaff ? STAFF_NAV : PLAYER_NAV;

  useEffect(() => {
    if (firebaseUser === null) router.replace("/login");
  }, [firebaseUser, router]);

  // Usuario nuevo (típicamente primer login con Google — la web no tiene
  // registro propio) que todavía no eligió rol/equipo. Se exige que NINGUNA
  // de las dos señales confirme que ya terminó: `onboardingComplete` es la
  // autoridad de servidor (válida en cualquier navegador/dispositivo, y la
  // que decide tras el backfill de cuentas ya existentes); el flag local
  // (`isOnboardingDone`) solo evita un parpadeo en la misma pestaña justo
  // tras terminar el wizard, mientras el `update` de servidor todavía viaja.
  // Mirror de _ActivityMain comprobando SetupActivity.isSetupDone en Android.
  const needsOnboarding =
    profile != null &&
    profile.onboardingComplete !== true &&
    !isOnboardingDone(firebaseUser?.uid ?? "");

  useEffect(() => {
    if (firebaseUser && needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [firebaseUser, needsOnboarding, router]);

  if (firebaseUser === undefined) return <BrandLoader />;
  if (firebaseUser === null) return null;
  if (needsOnboarding) return <BrandLoader />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <Link
            href="/home"
            aria-label="RugbySet — inicio"
            className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <BrandMark />
          </Link>

          {/* Nav superior solo en escritorio */}
          <nav className="hidden gap-1 md:flex">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  pathname.startsWith(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Selector de equipo activo — solo con más de un equipo (fase 2). */}
          <TeamSwitcher className="min-w-0" />

          <Link
            href="/notifications"
            aria-label={unreadCount > 0 ? `Avisos, ${unreadCount} sin leer` : "Avisos"}
            className={cn(
              "relative ml-auto flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              pathname.startsWith("/notifications")
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Bell className="size-5" />
            <UnreadDot count={unreadCount} className="top-1 right-1" />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Cuenta"
              className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <AvatarInitials
                name={profile?.nameSurname}
                src={profile?.usericon}
                className="size-9"
                fallbackClassName="text-xs"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href="/profile" />}>
                <User /> Perfil
              </DropdownMenuItem>
              {/* 2026-09-04: también quien dirige un club sin ser COACH global
                  (p.ej. un ADMIN que fundó/dirige un club) — antes solo isCoach.
                  2026-09-07: y cualquier miembro cuyo equipo activo está en un
                  club (jugador incluido) — ve la tarjeta informativa. "Club",
                  no "Mi club": para el jugador es el club de su equipo. */}
              {(isCoach(profile) ||
                isAdmin(profile) ||
                Boolean(profile?.directorOfClubId) ||
                Boolean(activeTeam?.clubId)) && (
                <DropdownMenuItem render={<Link href="/club" />}>
                  <Building2 /> Club
                </DropdownMenuItem>
              )}
              {isAdmin(profile) && (
                <DropdownMenuItem render={<Link href="/admin/approvals" />}>
                  <ClipboardCheck /> Cola de aprobación
                </DropdownMenuItem>
              )}
              {isAdmin(profile) && (
                <DropdownMenuItem render={<Link href="/admin/users" />}>
                  <UserCog /> Gestionar usuarios
                </DropdownMenuItem>
              )}
              {isAdmin(profile) && (
                <DropdownMenuItem render={<Link href="/admin/organization" />}>
                  <Shield /> Organización
                </DropdownMenuItem>
              )}
              {isAdmin(profile) && (
                <DropdownMenuItem render={<Link href="/admin/content" />}>
                  <FolderKanban /> Todo el contenido
                </DropdownMenuItem>
              )}
              {isAdmin(profile) && (
                <DropdownMenuItem render={<Link href="/admin/metrics" />}>
                  <BarChart3 /> Métricas
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
              >
                <LogOut /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <OfflineBanner />
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:pb-4 print:p-0">
        {children}
      </main>

      {/* Bottom navigation en móvil — como la app Android */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/15",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
