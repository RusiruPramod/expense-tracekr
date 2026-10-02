// src/lib/firebase.js
// Firebase initialization with Firestore offline persistence

import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCgoHKwN3z3ErA3ylh_nBdAbypphYQgv5k',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'expenses-70234.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || 'expenses-70234',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'expenses-70234.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '232906847717',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || '1:232906847717:web:1714776d786814a0c02b0c',
}

const app = initializeApp(firebaseConfig)

// Auth
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Firestore with modern offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

// Connect to local emulator in development
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080)
}

export default app
