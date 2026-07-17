import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth = getAuth(app);
if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence);
}

export const db = getDatabase(app);

// Storage: imágenes de ejercicios (exercises_images/{uid}/...) e iconos de
// equipo (team_images/{teamname}/...) — ver storage.rules en el repo Android.
export const storage = getStorage(app);

// Las callables (sendCustomPasswordResetEmail, sendPushNotification…) viven
// en us-central1 — la región por defecto de functions, NO la de la RTDB
// (europe-west1). Mismo valor que usa EmailService.kt en Android.
export const functions = getFunctions(app, "us-central1");
