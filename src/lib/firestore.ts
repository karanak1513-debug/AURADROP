import { db } from "./firebase";
import type { Firestore } from "firebase/firestore";

export { db };

export function getFirestoreDb(): Firestore {
  return db;
}

export default db;


