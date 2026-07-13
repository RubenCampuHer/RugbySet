import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * Enlace "volver" de las pantallas de detalle — sustituye el `← Ejercicios`
 * de texto duplicado en exercises/detail y trainings/detail.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronLeft className="size-4" />
      {label}
    </Link>
  );
}
