import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCc5KGocP_-QlSqZeacxXYbAQMk-LEoH3Y",
  authDomain: "oxford-house-expense-tracker.firebaseapp.com",
  projectId: "oxford-house-expense-tracker",
  storageBucket: "oxford-house-expense-tracker.firebasestorage.app",
  messagingSenderId: "893722301667",
  appId: "1:893722301667:web:2f29eafab1c7aa78d9a1d6",
  measurementId: "G-W6S7JWLXPV"
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }
} else {
  app = getApps()[0];
  auth = getAuth(app);
}

export { app, auth };
export default app;

