// Pestañas de las bibliotecas de ejercicios y entrenos (y del selector de
// entrenos del calendario). "Del club" (2026-09-23): contenido con
// privacidad Club del club del equipo activo. La visibilidad (aprobado,
// pendiente…) ya la aplican useExercises/useTrainings vía canView*.

export type LibraryTab = "all" | "club" | "favs" | "own";

type Item = {
  name?: string | null;
  author?: string | null;
  privacy?: string | null;
  clubId?: string | null;
};

export function matchesLibraryTab(
  item: Item,
  tab: LibraryTab,
  ctx: { username?: string | null; favNames: Set<string>; myClubId?: string | null },
): boolean {
  switch (tab) {
    case "all":
      return true;
    case "favs":
      return ctx.favNames.has(item.name ?? "");
    case "own":
      return item.author != null && item.author === ctx.username;
    case "club":
      return ctx.myClubId != null && item.privacy === "Club" && item.clubId === ctx.myClubId;
  }
}

/** Nombre de ejercicio/entreno: es la CLAVE en RTDB (mismas reglas que los editores: 3-50 caracteres, sin . # $ [ ] /). */
export function validateContentName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Mínimo 3 caracteres.";
  if (trimmed.length > 50) return "Máximo 50 caracteres.";
  if (/[.#$[\]/]/.test(trimmed)) return "No puede contener . # $ [ ] /";
  return null;
}
