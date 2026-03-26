// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

// Evitamos inicializar múltiples veces en desarrollo
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // El replace es vital porque las variables de entorno a veces rompen los saltos de línea de la clave
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    console.log("Firebase Admin inicializado correctamente.");
  } catch (error) {
    console.error("Error inicializando Firebase Admin:", error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
