"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const getSnapshot = () => navigator.onLine;
// Durante el prerender estático (build) no hay navigator: asumir online,
// igual que hará el cliente hasta que se conecte el listener tras hidratar.
const getServerSnapshot = () => true;

/**
 * Aviso de sin-conexión: la RTDB va por WebSocket (no pasa por el service
 * worker), así que sin este banner un offline se ve indistinguible de un
 * estado vacío (skeleton/spinner infinito).
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs font-medium text-warning">
      <WifiOff className="size-3.5" />
      Sin conexión — mostrando datos en caché
    </div>
  );
}
