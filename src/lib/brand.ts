// Gradientes de marca — espejo de los card gradients de la app Android
// (colors.xml: indigo, teal, blue, pink). Asignación determinista por texto
// para que cada elemento conserve siempre su color.
export const BRAND_GRADIENTS = [
  "from-[#6366F1] to-[#818CF8]", // indigo
  "from-[#14B8A6] to-[#10B981]", // teal
  "from-[#3B82F6] to-[#60A5FA]", // blue
  "from-[#EC4899] to-[#A855F7]", // pink
] as const;

export function gradientFor(s: string): string {
  const hash = [...s].reduce((h, c) => h + c.charCodeAt(0), 0);
  return BRAND_GRADIENTS[hash % BRAND_GRADIENTS.length];
}
