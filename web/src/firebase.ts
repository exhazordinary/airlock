import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

// Public by design: this identifies the project, it is not a credential.
// Access control lives in Firestore rules and Firebase Auth, never in hiding this.
const app = initializeApp({
  apiKey: "AIzaSyBIaD_-oPylkAqTyVcFUeIPr96YqnyGQOg",
  authDomain: "airlock-ideathon.firebaseapp.com",
  projectId: "airlock-ideathon",
  storageBucket: "airlock-ideathon.firebasestorage.app",
  messagingSenderId: "285164197878",
  appId: "1:285164197878:web:b8ecb34d2b96d3336a19d7",
});

export const auth = getAuth(app);
export const db = getFirestore(app);

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOut = () => fbSignOut(auth);
export const watchAuth = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb);

export async function api<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
