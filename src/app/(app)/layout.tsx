"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/exercises", label: "Ejercicios" },
  { href: "/trainings", label: "Entrenos" },
  { href: "/calendar", label: "Calendario" },
  { href: "/team", label: "Equipo" },
  { href: "/notifications", label: "Avisos" },
  { href: "/profile", label: "Perfil" },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (firebaseUser === null) router.replace("/login");
  }, [firebaseUser, router]);

  if (firebaseUser === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (firebaseUser === null) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/exercises" className="shrink-0 font-bold">
            RugbySet 🏉
          </Link>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                  pathname.startsWith(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  );
}
