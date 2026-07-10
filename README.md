# RugbySet Web

Web companion (solo lectura, MVP) de la app Android **RugbySet**
(`RugbyApplication`). Comparte el proyecto Firebase `rugbyapp-fbb38`:
Auth, Realtime Database (europe-west1), Storage y Cloud Functions.

- **Producción:** https://rugbyset.web.app
- **Plan:** `WEB_APP_PLAN.md` en el repo Android (plan v2, 2026-07-10)

## Stack

Next.js (App Router, `output: 'export'` — SPA estática) + TypeScript +
Tailwind v4 + shadcn/ui + Firebase Web SDK + Zod.

## Desarrollo

```bash
npm install
cp .env.local.example .env.local   # config pública del SDK, ya rellena
npm run dev
```

## Deploy

```bash
npm run build
firebase deploy --only hosting     # → rugbyset.web.app (site "rugbyset")
```

## Contrato de datos (anti-drift)

- Los schemas Zod de `src/lib/schemas/` son espejo 1:1 de los data class
  Kotlin del repo Android (`_User.kt`, `_Exercise.kt`, `_Training.kt`,
  `_Team.kt`, `_Club.kt`, `_Notification.kt`). Cada fichero indica su fuente.
- `src/lib/permissions.ts` es un port literal de `PermissionsManager.kt`
  (visibilidad privacy × approvalStatus). Si cambia allí, cambia aquí.
- `src/lib/constants.ts` espeja `FirebasePaths.kt`.
- Claves RTDB por NOMBRE (Exercises/Trainings/Teams); solo Clubs usa push id.
  Los detalles usan query param (`/exercises/detail?name=X`) por eso.
- Datos de otros usuarios: SIEMPRE desde `publicProfiles/{uid}` (proyección
  sin mail/fcmToken mantenida por la Cloud Function `mirrorPublicProfile`),
  nunca desde `Users/{uid}`.

## Sin registro web

Las cuentas se crean en la app Android (wizard de rol/club/equipo). La web
solo inicia sesión (email+password verificado, o Google).
