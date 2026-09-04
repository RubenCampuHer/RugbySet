"use client";

import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ensureUserProfile } from "@/lib/actions/onboarding";
import { ensureUserTeamMembership } from "@/lib/actions/team";
import { PATHS } from "@/lib/constants";
import { auth, db } from "@/lib/firebase";
import { parseOr } from "@/lib/schemas/common";
import { UserSchema } from "@/lib/schemas/user";
import type { User } from "@/lib/types";

interface AuthState {
  /** undefined = aún resolviendo la sesión; null = no autenticado */
  firebaseUser: FirebaseUser | null | undefined;
  /** Perfil de Users/{uid} en tiempo real (null hasta que carga) */
  profile: User | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: undefined,
  profile: null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [profileState, setProfileState] = useState<User | null>(null);
  // "(uid)/(equipo)" ya reconciliados en esta sesión — onValue vuelve a
  // disparar con cada cambio del perfil y no hay que repetir el get.
  const reconciledTeams = useRef(new Set<string>());

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      // Mismo criterio que Android (AuthRepository.login): sin email
      // verificado no hay sesión. Google entra con emailVerified=true.
      if (user && !user.emailVerified) {
        void signOut(auth);
        setFirebaseUser(null);
        return;
      }
      setFirebaseUser(user);
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const userRef = ref(db, `${PATHS.USERS}/${firebaseUser.uid}`);
    return onValue(userRef, (snap) => {
      if (!snap.exists()) {
        // Cuenta autenticada sin nodo Users/{uid} — típicamente un primer
        // login con Google (la web no tiene registro propio, ver
        // ensureUserProfile). Se autocura aquí, no solo en el botón de
        // Google, para cubrir también sesiones ya persistidas de cuentas
        // afectadas por este bug antes del fix. El propio onValue recibirá
        // el valor recién creado y actualizará el perfil.
        void ensureUserProfile(firebaseUser);
        return;
      }
      const parsed = parseOr(UserSchema, snap.val(), `Users/${firebaseUser.uid}`);
      setProfileState(parsed);
      // Varios equipos (fase 1, 2026-09-04): el equipo ACTIVO del perfil debe
      // figurar en UserTeams/{uid}. Se autocura aquí — mismo sitio que
      // ensureUserProfile — para cubrir altas hechas desde Android (que solo
      // escribe teamname) y cuentas anteriores al backfill, sin tocar Android.
      if (parsed?.teamname) {
        const key = `${firebaseUser.uid}/${parsed.teamname}`;
        if (!reconciledTeams.current.has(key)) {
          reconciledTeams.current.add(key);
          ensureUserTeamMembership(firebaseUser.uid, parsed.teamname).catch((error) =>
            console.error("ensureUserTeamMembership:", error),
          );
        }
      }
    });
  }, [firebaseUser]);

  // Derivado (no seteado en el effect): sin sesión no hay perfil, aunque el
  // estado conserve el del usuario anterior hasta la próxima suscripción.
  const profile = firebaseUser ? profileState : null;

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
