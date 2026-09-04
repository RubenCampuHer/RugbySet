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
  if (!name.trim()) return "El nombre del equipo es obligatorio.";
  if (FORBIDDEN_KEY_CHARS.test(name)) return "No puede contener . # $ [ ] /";
  return null;
}

/** Nombre de club — solo display (Clubs/{clubId} usa un id opaco), sin caracteres prohibidos que vigilar. */
export function validateClubName(name: string): string | null {
  if (!name.trim()) return "El nombre del club es obligatorio.";
  if (name.trim().length > 80) return "Máximo 80 caracteres.";
  return null;
}

export function validateTeamCode(code: string): string | null {
  if (!code.trim()) return "Elige un código para tu equipo.";
  return null;
}

/**
 * Sugerencia de código de equipo a partir del nombre — el entrenador
 * confundía "Código de acceso" con algo que debía recibir, no inventar
 * (ver plan onboarding 2026-09-03). Precargar un código plausible, editable,
 * hace evidente que es él quien lo elige. `suffix` se genera aparte
 * (Math.random en la UI) para poder testear esta función con un valor fijo.
 */
export function suggestTeamCode(teamName: string, suffix: string): string {
  // Quitar todo lo que no sea A-Z0-9 ya descarta tildes/ñ de paso (una "Ñ"
  // o una "Á" no son A-Z ASCII) — no hace falta normalizar NFD aparte.
  const base = teamName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  return `${base || "EQUIPO"}${suffix}`;
}

/** Sufijo aleatorio de 3 dígitos para suggestTeamCode — separado para poder testear con uno fijo. */
export function randomCodeSuffix(): string {
  return String(Math.floor(100 + Math.random() * 900));
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
