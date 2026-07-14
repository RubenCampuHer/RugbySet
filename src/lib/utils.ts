import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Genera un nombre disponible con sufijo incremental (_copy, _copy2, ...)
 * dado un chequeo de existencia — usado al duplicar ejercicios/entrenos.
 * Mejora deliberada sobre Android, que sobrescribe silenciosamente si
 * "{name}_copy" ya existe.
 */
export async function findAvailableName(
  base: string,
  exists: (name: string) => Promise<boolean>,
): Promise<string> {
  let candidate = `${base}_copy`;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${base}_copy${suffix}`;
    suffix++;
  }
  return candidate;
}
