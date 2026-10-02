/**
 * src/context/GroupContext.jsx
 * Manages the currently active group and real-time Firestore subscriptions.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  getDocs,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './AuthContext'

const GroupContext = createContext(null)

export function GroupProvider({ children }) {
  const { user } = useAuth()

  const [groups,      setGroups]      = useState([])
  const [activeGroup, setActiveGroup] = useState(null) // full group doc
  const [members,     setMembers]     = useState([])   // resolved user docs + guests
  const [expenses,    setExpenses]    = useState([])
  const [settlements, setSettlements] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  // ── Load user's groups ────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setGroups([]); setLoading(false); return }

    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const gs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setGroups(gs)

      // Auto-select the first group (or the saved one)
      const savedId = localStorage.getItem('expense_tracker_group')
      const found   = gs.find((g) => g.id === savedId) || gs[0]
      if (found && activeGroup?.id !== found.id) {
        selectGroup(found)
      } else if (gs.length === 0) {
        setActiveGroup(null)
        setLoading(false)
      }
    }, (err) => { setError(err.message); setLoading(false) })

    return unsub
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  // ── Select active group and subscribe to its data ─────────
  const selectGroup = useCallback(async (group) => {
    if (!group?.id) return
    setActiveGroup(group)
    localStorage.setItem('expense_tracker_group', group.id)
    await resolveMembers(group)
  }, [])

  const resolveMembers = async (group) => {
    try {
      const resolved = []

      // Registered members
      for (const uid of group.memberIds || []) {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) resolved.push({ id: uid, ...snap.data(), isGuest: false })
      }

      // Guest members
      for (const guest of group.guestMembers || []) {
        resolved.push({ id: guest.id, name: guest.name, isGuest: true })
      }

      setMembers(resolved)
    } catch (err) {
      console.error('resolveMembers error:', err)
    }
  }

  // ── Subscribe to expenses ─────────────────────────────────
  useEffect(() => {
    if (!activeGroup?.id) { setExpenses([]); return }

    setLoading(true)
    const q = query(
      collection(db, 'groups', activeGroup.id, 'expenses'),
      orderBy('date', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const exps = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setExpenses(exps)
      setLoading(false)
    }, (err) => { setError(err.message); setLoading(false) })

    return unsub
  }, [activeGroup?.id])

  // ── Subscribe to settlements ──────────────────────────────
  useEffect(() => {
    if (!activeGroup?.id) { setSettlements([]); return }

    const q = query(
      collection(db, 'groups', activeGroup.id, 'settlements'),
      orderBy('date', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    return unsub
  }, [activeGroup?.id])

  const refreshGroup = async () => {
    if (!activeGroup?.id) return
    const snap = await getDoc(doc(db, 'groups', activeGroup.id))
    if (snap.exists()) {
      const group = { id: snap.id, ...snap.data() }
      setActiveGroup(group)
      await resolveMembers(group)
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
