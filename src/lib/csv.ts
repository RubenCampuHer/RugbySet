/**
 * CSV mínimo (RFC4180), sin librería — para exports pequeños generados en
 * cliente (informe de asistencia). No pensado para datasets grandes ni para
 * parsear CSV, solo para generarlo.
 */

function escapeCsvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

/**
 * Descarga un CSV generado en cliente. A diferencia de la descarga de
 * imágenes de Storage (origen cruzado, poco fiable según el navegador — ver
 * exercises/detail), esto es un blob del mismo origen: el atributo download
 * siempre funciona. BOM UTF-8 (﻿) para que Excel detecte bien tildes/ñ.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
