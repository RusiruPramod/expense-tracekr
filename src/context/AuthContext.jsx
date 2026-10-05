/**
 * src/context/AuthContext.jsx
 * Provides Firebase Auth state across the app.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

const AuthContext = createContext(null)

const getCachedProfile = (uid) => {
  try {
    const raw = localStorage.getItem(`splitly_profile_${uid}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const setCachedProfile = (uid, data) => {
  try {
    localStorage.setItem(`splitly_profile_${uid}`, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => auth.currentUser || null)
  const [profile, setProfile] = useState(() => {
    if (auth.currentUser?.uid) {
      return getCachedProfile(auth.currentUser.uid) || {
        id: auth.currentUser.uid,
        name: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'User',
        email: auth.currentUser.email || '',
      }
    }
    return null
  })
  const [loading, setLoading] = useState(() => !auth.currentUser)

  // Subscribe to Firebase auth state and real-time Firestore profile
  useEffect(() => {
    let profileUnsub = null

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (profileUnsub) {
        profileUnsub()
        profileUnsub = null
      }

      if (firebaseUser) {
        // Fast optimistic profile from local cache
        const cached = getCachedProfile(firebaseUser.uid)
        const fallbackName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User')
        const optimistic = cached || {
          id: firebaseUser.uid,
          name: fallbackName,
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || null,
        }
        setProfile(optimistic)

        // Real-time Firestore profile listener with auto-creation
        profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() }
            setProfile(data)
            setCachedProfile(firebaseUser.uid, data)
          } else {
            // Document does not exist yet (e.g. fresh user or cleaned DB) — auto-create
            await upsertUserDoc(firebaseUser)
          }
        }, (err) => {
          console.warn('Real-time profile listener warning:', err)
        })
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      authUnsub()
      if (profileUnsub) profileUnsub()
    }
  }, [])

  /** Create or update user Firestore doc */
  const upsertUserDoc = async (firebaseUser, extra = {}) => {
    const fallbackName = firebaseUser.displayName || extra.name || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User')
    const data = {
      name:      fallbackName,
      email:     firebaseUser.email || `${fallbackName.toLowerCase().replace(/\s+/g, '')}@expensetracker.local`,
      photoURL:  firebaseUser.photoURL || null,
      language:  localStorage.getItem('expense_tracker_lang') || 'si',
      updatedAt: serverTimestamp(),
    }
    setProfile({ id: firebaseUser.uid, ...data })
    setCachedProfile(firebaseUser.uid, { id: firebaseUser.uid, ...data })

    const ref = doc(db, 'users', firebaseUser.uid)
    await setDoc(ref, { ...data, createdAt: serverTimestamp() }, { merge: true })
  }

  const signIn = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email, password, name) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName: name })
    await upsertUserDoc(result.user, { name })
    return result
  }

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    await upsertUserDoc(result.user)
    return result
  }

  const signInGuest = async (customName = 'Guest User') => {
    const result = await signInAnonymously(auth)
    await updateProfile(result.user, { displayName: customName })
    await upsertUserDoc(result.user, { name: customName })
    return result
  }

  const logout = () => signOut(auth)

  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

  const updateUserProfile = async (data) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
    if (data.name) await updateProfile(user, { displayName: data.name })
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInGuest,
    logout,
    resetPassword,
    updateUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
