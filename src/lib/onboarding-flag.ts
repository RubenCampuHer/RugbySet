// Espejo de SetupActivity.PREF_SETUP_DONE/markSetupDone (Android): un flag
// local por-instalación (aquí, por-navegador) que marca que este uid ya vio
// el wizard de onboarding (elegir rol, unirse/crear equipo) — no un dato de
// servidor. No se deriva de `teamname` porque un jugador que solicitó unirse
// (pending) legítimamente no tiene teamname todavía y ya completó el wizard.
const PREFIX = "rugbyset_onboarding_done_";

export function isOnboardingDone(uid: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(`${PREFIX}${uid}`) === "1";
  } catch {
    return true; // localStorage bloqueado (modo privado) — no atascar al usuario
  }
}

export function markOnboardingDone(uid: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${uid}`, "1");
  } catch {
    // localStorage bloqueado — el flag no persiste, pero no rompe el flujo
  }
}
