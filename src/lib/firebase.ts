import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBlZHdX_h3rO0M7lKq6qX1ctZhcA-qFnIw",
  authDomain: "savemoney-2f682.firebaseapp.com",
  projectId: "savemoney-2f682",
  storageBucket: "savemoney-2f682.firebasestorage.app",
  messagingSenderId: "288019198789",
  appId: "1:288019198789:web:e0c6fdc6db46a68d7ec42c",
  measurementId: "G-7V6Y2NYBH9"
};

// Safe singleton Firebase app
export const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

let authInstance: Auth;
try {
  authInstance = getAuth(app);
} catch {
  authInstance = {} as Auth;
}
export const auth = authInstance;

let firestoreInstance: Firestore;
try {
  firestoreInstance = getFirestore(app);
} catch {
  try {
    firestoreInstance = initializeFirestore(app, {});
  } catch (e) {
    console.warn('[Firebase] Firestore init warning:', e);
    firestoreInstance = {} as Firestore;
  }
}
export const db: Firestore = firestoreInstance;

export default app;

