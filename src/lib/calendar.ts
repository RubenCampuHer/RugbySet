// Utilidades de fecha del calendario — formato compartido con Android: "dd/MM/yyyy".

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export const WEEKDAY_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

export function toKey(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

/** Parsea "dd/MM/yyyy" a Date (medianoche local); null si el formato no encaja. */
export function parseKey(fecha: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha);
  if (!m) return null;
  const [, d, mo, y] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

export function todayKey(): string {
  const now = new Date();
  return toKey(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "dd-MM-yyyy" (guiones) para usar en query params sin escapar barras. */
export function keyToParam(fecha: string): string {
  return fecha.replaceAll("/", "-");
}

export function paramToKey(param: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(param);
  if (!m) return null;
  return `${m[1]}/${m[2]}/${m[3]}`;
}
