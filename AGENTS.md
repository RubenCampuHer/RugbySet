<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RugbySet Web — guía del proyecto

SPA estática (Next.js `output: 'export'`) espejo SOLO LECTURA de la app
Android RugbySet. Mismo Firebase: `rugbyapp-fbb38` (RTDB en **europe-west1**,
callables en **us-central1**). Producción: https://rugbyset.web.app

## Reglas de oro

1. **El contrato de datos vive en el repo Android**
   (`C:\Users\ruben\OneDrive\Personal\RugbyApplication`). Los schemas Zod de
   `src/lib/schemas/` son espejo 1:1 de los data class Kotlin — nombres de
   campo en español tal cual RTDB (`descCorta`, `tiempoSeccion`, `usercoach`).
   Nunca "traducir" nombres de campo.
2. **Datos de otros usuarios → `publicProfiles/{uid}`**, nunca `Users/{uid}`
   (las reglas solo permiten leer el nodo propio; publicProfiles es una
   proyección sin mail/fcmToken mantenida por Cloud Function).
3. **Visibilidad de contenido** → usar SIEMPRE `canViewExercise` /
   `canViewTraining` de `src/lib/permissions.ts` (port literal de
   `PermissionsManager.kt`). No inventar lógica de filtrado.
4. **Listas RTDB** pueden llegar como array, objeto-con-índices o null →
   usar `rtdbList()` de `schemas/common.ts`. Parseo SIEMPRE tolerante con
   `parseOr`/`parseMapOr` (hay datos legacy reales).
5. **Sin rutas dinámicas** (`[id]`): output export + claves-por-nombre →
   detalles con query param (`/exercises/detail?name=X`).
6. **MVP solo lectura**: no añadir escrituras a RTDB salvo el nodo propio
   (p.ej. marcar notificación leída). Las creaciones van en la app Android.
7. `useSearchParams` exige envolver el componente en `<Suspense>` (export
   estático).

## Comandos

- `npm run dev` / `npm run build` / `npm run lint`
- Deploy: `npm run build && firebase deploy --only hosting` (site `rugbyset`)

## Plan

`WEB_APP_PLAN.md` en el repo Android (v2). Estado actual: F2 (bootstrap +
auth + /exercises). Pendiente: F3 completo, F4 (trainings/calendar/team/club),
F5 (notifications/profile/PWA).
