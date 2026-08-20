// Lógica pura de validación de equipo/club — sin imports de Firebase, a
// propósito: así se puede testear como unidad sin inicializar el SDK (ver
// team-validation.test.ts). lib/actions/onboarding.ts reexporta esto para
// no romper a quien ya importaba desde ahí.

/**
 * Mismos caracteres prohibidos que Android (FORBIDDEN_KEY_CHARS en
 * SetupCreateTeamFragment): el nombre del equipo es la CLAVE en RTDB y estos
 * caracteres provocan un error de Firebase si no se filtran antes.
 */
const FORBIDDEN_KEY_CHARS = /[.#$[\]/]/;

export function validateTeamName(name: string): string | null {
  if (!name.trim()) return "Requerido";
  if (FORBIDDEN_KEY_CHARS.test(name)) return "No puede contener . # $ [ ] /";
  return null;
}

/** Espejo de Club.CATEGORIES (Android). */
export const CLUB_CATEGORIES = [
  "Seniors",
  "Sub-21",
  "Sub-18",
  "Sub-16",
  "Sub-14",
  "Femenino",
  "Veteranos",
  "Otro",
] as const;
