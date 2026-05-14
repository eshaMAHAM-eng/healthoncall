/**
 * HealthOnCall — single Firebase Web client config.
 * Load this script before firebase-app-compat.js on every page that initializes Firebase.
 * Security is enforced with Firestore Rules + Auth (not by hiding the apiKey).
 */
window.HOC_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYoa7561DL9CA-PAu2fkaC6xO80iYhZXw",
  authDomain: "healthoncall-97216.firebaseapp.com",
  projectId: "healthoncall-97216",
  storageBucket: "healthoncall-97216.firebasestorage.app",
  messagingSenderId: "159711752974",
  appId: "1:159711752974:web:0667526008707309e81d5f"
};

/** Stripe — set STRIPE_SECRET_KEY in Vercel env; optional publishable key for Elements later */
window.HOC_STRIPE_PUBLISHABLE_KEY = "";
