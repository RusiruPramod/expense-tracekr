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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
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

  // Subscribe to Firebase auth state — unblocks UI immediately without waiting for Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Fast optimistic profile from local cache or auth claims
        const cached = getCachedProfile(firebaseUser.uid)
        const fallbackName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User')
        const optimistic = cached || {
          id: firebaseUser.uid,
          name: fallbackName,
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || null,
        }
        setProfile(optimistic)
        // Background sync Firestore doc (non-blocking)
        fetchProfile(firebaseUser.uid)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const fetchProfile = async (uid) => {
    try {
      const ref  = doc(db, 'users', uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setProfile(data)
        setCachedProfile(uid, data)
      }
    } catch (err) {
      console.warn('fetchProfile non-blocking error:', err)
    }
  }

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
    const result = await signInWithEmailAndPassword(auth, email, password)
    // Non-blocking profile fetch in background
    fetchProfile(result.user.uid)
    return result
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
    await fetchProfile(user.uid)
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
    fetchProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
