"use client";

import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  LogOut,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AvatarInitials } from "@/components/AvatarInitials";
import { BrandMark } from "@/components/Brand";
import { BrandLoader } from "@/components/BrandLoader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// 5 destinos como la bottom navigation Material de la app Android;
// Perfil vive en el avatar del header.
const NAV = [
  { href: "/exercises", label: "Ejercicios", icon: Dumbbell },
  { href: "/trainings", label: "Entrenos", icon: ClipboardList },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/team", label: "Equipo", icon: Users },
  { href: "/notifications", label: "Avisos", icon: Bell },
] as const;

function UnreadDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 right-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (firebaseUser === null) router.replace("/login");
  }, [firebaseUser, router]);

  if (firebaseUser === undefined) return <BrandLoader />;
  if (firebaseUser === null) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <Link
            href="/exercises"
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
                {href === "/notifications" && <UnreadDot count={unreadCount} />}
              </Link>
            ))}
          </nav>

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
              {isAdmin(profile) && (
                <DropdownMenuItem render={<Link href="/admin/approvals" />}>
                  <ClipboardCheck /> Cola de aprobación
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
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:pb-4">
        {children}
      </main>

      {/* Bottom navigation en móvil — como la app Android */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
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
                  {href === "/notifications" && <UnreadDot count={unreadCount} />}
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
