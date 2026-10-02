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

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null) // Firestore user doc
  const [loading, setLoading] = useState(true)

  // Subscribe to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid)
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
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() })
    } catch (err) {
      console.error('fetchProfile error:', err)
    }
  }

  /** Create or update user Firestore doc */
  const upsertUserDoc = async (firebaseUser, extra = {}) => {
    const ref = doc(db, 'users', firebaseUser.uid)
    const snap = await getDoc(ref)
    const data = {
      name:      firebaseUser.displayName || extra.name || 'Rusiru',
      email:     firebaseUser.email || 'guest@expensetracker.local',
      photoURL:  firebaseUser.photoURL || null,
      language:  localStorage.getItem('expense_tracker_lang') || 'en',
      updatedAt: serverTimestamp(),
    }
    if (!snap.exists()) data.createdAt = serverTimestamp()
    await setDoc(ref, data, { merge: true })
    setProfile({ id: firebaseUser.uid, ...data })
  }

  const signIn = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await fetchProfile(result.user.uid)
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

  const signInGuest = async () => {
    const result = await signInAnonymously(auth)
    await upsertUserDoc(result.user, { name: 'Rusiru (Guest)' })
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
