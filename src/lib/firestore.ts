import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import app from "./firebase";

let _db: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (!_db) {
    try {
      _db = getFirestore(app);
    } catch {
      try {
        _db = initializeFirestore(app, {});
      } catch (e2) {
        console.warn('[Firebase] Firestore init error:', e2);
        return {} as Firestore;
      }
    }
  }
  return _db;
}

// Client-safe proxy for Firestore instance
export const db: Firestore = new Proxy({} as Firestore, {
  get(target, prop, receiver) {
    const liveInstance = getFirestoreDb();
    const val = Reflect.get(liveInstance, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(liveInstance);
    }
    return val;
  },
});

export default db;
