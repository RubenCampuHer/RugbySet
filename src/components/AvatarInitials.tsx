import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Iniciales de un nombre — hasta dos palabras, no los dos primeros caracteres. */
function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Avatar con fallback de iniciales — unifica los 4 usos duplicados de
 * `name.slice(0, 2).toUpperCase()` (header, perfil, equipo, chips de
 * jugador).
 */
export function AvatarInitials({
  name,
  src,
  size = "default",
  className,
  fallbackClassName,
}: {
  name?: string | null;
  src?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar size={size} className={cn("border border-border", className)}>
      <AvatarImage src={src ?? undefined} />
      <AvatarFallback className={fallbackClassName}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
