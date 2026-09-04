"use client";

import { useEffect, useState } from "react";

/**
 * `true` si `active` lleva más de `ms` seguido en `true` — para detectar una
 * carga que nunca resuelve (bug real reportado 2026-09-04: "Ver asistencia"
 * se quedaba "pensando" sin fin, sin ningún error visible — un listener de
 * RTDB que por lo que sea nunca dispara ni éxito ni error, p.ej. tras
 * recargar la página en mitad de una reconexión de red, deja al usuario sin
 * ninguna salida salvo cerrar la app). Pensado para envolver el `loading`
 * que ya devuelven useTeam()/useClub() y mostrar "Reintentar" en vez de un
 * esqueleto indefinido — recargar la página siempre reintenta desde cero
 * (nuevas suscripciones onValue), a diferencia de esperar sin más.
 *
 * El reinicio de `fired` al cambiar `active` usa el patrón oficial de React
 * "ajustar estado durante el render" (sin useEffect: setState condicionado
 * dentro del cuerpo del componente, react.dev/reference/react/useState) —
 * evita el aviso react-hooks/set-state-in-effect de llamar a setState
 * síncronamente en el cuerpo de un efecto, y no lee ningún ref durante el
 * render (react-hooks/refs).
 */
export function useLoadingTimeout(active: boolean, ms = 9000): boolean {
  const [fired, setFired] = useState(false);
  const [prevActive, setPrevActive] = useState(active);

  if (active !== prevActive) {
    setPrevActive(active);
    setFired(false);
  }

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setFired(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);

  return active && fired;
}
