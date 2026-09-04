// Lógica pura de validación del nombre y apellidos de una persona — sin
// imports de Firebase, a propósito, mismo patrón que team-validation.ts (así
// se testea como unidad sin inicializar el SDK). El límite de 80 caracteres
// coincide con el `.validate` de Users/{uid}/nameSurname en
// database.rules.json (repo Android) — mantener en sincronía.

const MAX_LENGTH = 80;

export function validateNameSurname(name: string): string | null {
  if (!name.trim()) return "El nombre es obligatorio.";
  if (name.trim().length > MAX_LENGTH) return `Máximo ${MAX_LENGTH} caracteres.`;
  return null;
}
