"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BrandLoader } from "@/components/BrandLoader";

// La landing pública llegará en F7 (plan v2 §F7); de momento la raíz
// redirige según el estado de sesión.
export default function Home() {
  const { firebaseUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (firebaseUser === undefined) return; // resolviendo sesión
    router.replace(firebaseUser ? "/exercises" : "/login");
  }, [firebaseUser, router]);

  return <BrandLoader />;
}
