"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Bug real reportado 2026-09-04: un despliegue ya verificado (headers
 * frescos en el servidor) seguía "sin efecto" para un usuario real — la
 * pestaña llevaba abierta desde antes del deploy y la navegación entre
 * páginas es client-side (SPA), así que nunca vuelve a pedir el documento
 * ni se entera de que hay código nuevo. El navegador SÍ revisa /sw.js en
 * segundo plano (bytes distintos → nuevo SW en estado "installing"), pero
 * sin avisar a nadie no pasa nada hasta que el usuario recarga por su
 * cuenta — con reload() explícito, sin más, cambiar de pestaña bastaría
 * para quedarse atascado indefinidamente. Aviso persistente que ofrece
 * recargar en cuanto hay una versión nueva instalada y esperando activarse.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Solo tras skipWaiting() de una actualización real (no la primera
      // instalación, que no tiene controller previo) — evita un reload en
      // bucle si algo dispara esto más de una vez.
      if (reloading) return;
      reloading = true;
      location.reload();
    });

    const notifyUpdate = (registration: ServiceWorkerRegistration) => {
      toast("Hay una versión nueva de RugbySet", {
        description: "Recarga para verla.",
        duration: Infinity,
        action: {
          label: "Recargar",
          onClick: () => registration.waiting?.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Ya había una esperando cuando esta pestaña arrancó (p.ej. se instaló
      // mientras la pestaña estaba en segundo plano).
      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyUpdate(registration);
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            notifyUpdate(registration);
          }
        });
      });
      // La navegación entre páginas de esta app es client-side (SPA): sin
      // una recarga de documento, el navegador no vuelve a comprobar /sw.js
      // por su cuenta. Revisar al recuperar el foco cubre justo el caso
      // real: pestaña abierta de fondo mientras se despliega una versión
      // nueva.
      const onVisible = () => {
        if (document.visibilityState === "visible") void registration.update();
      };
      document.addEventListener("visibilitychange", onVisible);
    });
  }, []);
  return null;
}
