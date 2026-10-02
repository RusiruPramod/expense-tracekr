/**
 * src/context/GroupContext.jsx
 * Manages the currently active group and real-time Firestore subscriptions.
 * Fully integrated with the seed data path (real UIDs + guest IDs).
 */

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const { user } = useAuth()

  const [groups,      setGroups]      = useState([])
  const [activeGroup, setActiveGroup] = useState(null)
  const [members,     setMembers]     = useState([])
  const [expenses,    setExpenses]    = useState([])
  const [settlements, setSettlements] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  // Use refs to avoid stale closures in async callbacks
  const userRef      = useRef(user)
  const activeIdRef  = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  // ── Resolve member names ───────────────────────────────────
  const resolveMembers = async (group) => {
    if (!group) return

    try {
      const resolved = []
      const currentUser = userRef.current

      // Registered members: read from users/{uid} in Firestore
      for (const uid of group.memberIds || []) {
        const snap = await getDoc(doc(db, 'users', uid))
        let name = 'User'

        if (snap.exists() && snap.data().name) {
          // Use the Firestore stored name (seed sets this to 'Rusiru' etc.)
          name = snap.data().name
        } else if (currentUser?.uid === uid) {
          // Fallback: Firebase Auth displayName
          name = currentUser.displayName || 'Rusiru'
        }

        resolved.push({
          id:      uid,
          name,
          email:   snap.data()?.email || currentUser?.email || '',
          isGuest: false,
        })
      }

      // Guest members (Sahan, Kalum from seed, or any added via Add Friend)
      for (const guest of group.guestMembers || []) {
        resolved.push({
          id:      guest.id,
          name:    guest.name,
          isGuest: true,
        })
      }

      setMembers(resolved)
    } catch (err) {
      console.error('resolveMembers error:', err)
    }
  }

  // ── Select active group ────────────────────────────────────
  const selectGroup = async (group) => {
    if (!group?.id) return
    activeIdRef.current = group.id
    setActiveGroup(group)
    localStorage.setItem('expense_tracker_group', group.id)
    await resolveMembers(group)
  }

  // ── Load user's groups (real-time) ─────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setGroups([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, async (snap) => {
      const gs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setGroups(gs)

      if (gs.length === 0) {
        setActiveGroup(null)
        setMembers([])
        setLoading(false)
        return
      }

      // Auto-select: prefer saved group ID, else most recent
      const savedId = localStorage.getItem('expense_tracker_group')
      const found   = gs.find((g) => g.id === savedId) || gs[0]

      if (found) {
        await selectGroup(found)
      }
    }, (err) => {
      setError(err.message)
      setLoading(false)
    })

    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // ── Subscribe to expenses ──────────────────────────────────
  useEffect(() => {
    if (!activeGroup?.id) {
      setExpenses([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'groups', activeGroup.id, 'expenses'),
      orderBy('date', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      setError(err.message)
      setLoading(false)
    })

    return unsub
  }, [activeGroup?.id])

  // ── Subscribe to settlements ───────────────────────────────
  useEffect(() => {
    if (!activeGroup?.id) {
      setSettlements([])
      return
    }

    const q = query(
      collection(db, 'groups', activeGroup.id, 'settlements'),
      orderBy('date', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    return unsub
  }, [activeGroup?.id])

  // ── Refresh active group (called after mutations) ──────────
  const refreshGroup = async () => {
    if (!activeGroup?.id) return
    try {
      const snap = await getDoc(doc(db, 'groups', activeGroup.id))
      if (snap.exists()) {
        const group = { id: snap.id, ...snap.data() }
        setActiveGroup(group)
        await resolveMembers(group)
      }
    } catch (err) {
      console.error('refreshGroup error:', err)
    }
  }

  const value = {
    groups,
    activeGroup,
    members,
    expenses,
    settlements,
    loading,
    error,
    selectGroup,
    refreshGroup,
    setActiveGroup,
  }

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within GroupProvider')
  return ctx
}
