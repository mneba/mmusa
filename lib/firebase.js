// lib/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCvGrIwg9Qh94xEjNHAXi08XdcE6sPxqsQ",
  authDomain: "data-firebase-af89d.firebaseapp.com",
  projectId: "data-firebase-af89d",
  storageBucket: "data-firebase-af89d.firebasestorage.app",
  messagingSenderId: "390124547500",
  appId: "1:390124547500:web:ff46dfa5b843d6da975e09",
  measurementId: "G-4RRFBZDF9V"
};

// Initialize Firebase (prevent multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth
export const auth = getAuth(app);

// Google Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Firestore
export const db = getFirestore(app);

export default app;
