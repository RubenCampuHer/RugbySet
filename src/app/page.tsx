"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

// La landing pública llegará en F7 (plan v2 §F7); de momento la raíz
// redirige según el estado de sesión.
export default function Home() {
  const { firebaseUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (firebaseUser === undefined) return; // resolviendo sesión
    router.replace(firebaseUser ? "/exercises" : "/login");
  }, [firebaseUser, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Cargando…</p>
    </main>
  );
}
