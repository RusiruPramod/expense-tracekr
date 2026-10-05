/**
 * src/context/GroupContext.jsx
 * Manages the currently active group and real-time Firestore subscriptions.
 * Fully optimized with in-memory caching, parallel resolution, and optimistic state updates.
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
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
import { seedInitialData } from '../lib/seed'

const GroupContext = createContext(null)

// Global in-memory user profile cache (persists across component mounts)
const userProfileCache = new Map()

const getCachedGroup = (uid) => {
  if (!uid) return null
  try {
    const raw = localStorage.getItem(`splitly_cached_group_${uid}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const getCachedMembers = (uid) => {
  if (!uid) return []
  try {
    const raw = localStorage.getItem(`splitly_cached_members_${uid}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function GroupProvider({ children }) {
  const { user } = useAuth()

  const [groups,      setGroups]      = useState([])
  const [activeGroup, setActiveGroup] = useState(() => getCachedGroup(user?.uid))
  const [members,     setMembers]     = useState(() => getCachedMembers(user?.uid))
  const [expenses,    setExpenses]    = useState([])
  const [settlements, setSettlements] = useState([])
  const [loading,     setLoading]     = useState(() => !getCachedGroup(user?.uid))
  const [error,       setError]       = useState(null)

  // Use refs to avoid stale closures in async callbacks
  const userRef      = useRef(user)
  const activeIdRef  = useRef(activeGroup?.id || null)
  const isSeedingRef = useRef(false)
  const expensesRef  = useRef(expenses)
  const settlementsRef = useRef(settlements)

  useEffect(() => {
    userRef.current = user
    if (user?.uid && !activeGroup) {
      const cached = getCachedGroup(user.uid)
      if (cached) {
        setActiveGroup(cached)
        activeIdRef.current = cached.id
        setMembers(getCachedMembers(user.uid))
        setLoading(false)
      }
    }
  }, [user, activeGroup])

  useEffect(() => {
    expensesRef.current = expenses
  }, [expenses])

  useEffect(() => {
    settlementsRef.current = settlements
  }, [settlements])

  // ── Fast Parallel Member Resolution with In-Memory Cache ──
  const resolveMembers = useCallback(async (group) => {
    if (!group) return

    try {
      const currentUser = userRef.current
      const uids = group.memberIds || []
      const guests = group.guestMembers || []

      // Populate current user immediately in cache if available
      if (currentUser?.uid) {
        const myName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User')
        const myEmail = currentUser.email || ''
        if (!userProfileCache.has(currentUser.uid)) {
          userProfileCache.set(currentUser.uid, { name: myName, email: myEmail })
        }
      }

      // Identify cache misses
      const missingUids = uids.filter((uid) => !userProfileCache.has(uid))

      // Fetch all missing user profiles in parallel (0 sequential delay)
      if (missingUids.length > 0) {
        await Promise.all(
          missingUids.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid))
              if (snap.exists() && snap.data().name) {
                userProfileCache.set(uid, {
                  name: snap.data().name,
                  email: snap.data().email || '',
                })
              } else if (currentUser?.uid === uid) {
                userProfileCache.set(uid, {
                  name: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
                  email: currentUser.email || '',
                })
              } else {
                userProfileCache.set(uid, { name: 'Member', email: '' })
              }
            } catch (e) {
              console.warn('Could not load profile for member', uid, e)
              if (currentUser?.uid === uid) {
                userProfileCache.set(uid, {
                  name: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
                  email: currentUser.email || '',
                })
              } else {
                userProfileCache.set(uid, { name: 'Member', email: '' })
              }
            }
          })
        )
      }

      // Build resolved members list instantly from cache
      const resolved = []
      for (const uid of uids) {
        const cached = userProfileCache.get(uid) || { name: 'Member', email: '' }
        resolved.push({
          id:      uid,
          name:    cached.name,
          email:   cached.email,
          isGuest: false,
        })
      }

      for (const guest of guests) {
        resolved.push({
          id:      guest.id,
          name:    guest.name,
          isGuest: true,
        })
      }

      setMembers(resolved)
      if (userRef.current?.uid) {
        try {
          localStorage.setItem(`splitly_cached_members_${userRef.current.uid}`, JSON.stringify(resolved))
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('resolveMembers error:', err)
    }
  }, [])

  // ── Select active group ────────────────────────────────────
  const selectGroup = useCallback(async (group) => {
    if (!group?.id) return
    if (activeIdRef.current === group.id && activeGroup) {
      // Already active, just resolve members if needed
      await resolveMembers(group)
      return
    }

    activeIdRef.current = group.id
    setActiveGroup(group)

    if (user?.uid) {
      try {
        localStorage.setItem(`splitly_cached_group_${user.uid}`, JSON.stringify(group))
        localStorage.setItem(`expense_tracker_group_${user.uid}`, group.id)
      } catch { /* ignore */ }
    }
    localStorage.setItem('expense_tracker_group', group.id)
    await resolveMembers(group)
  }, [activeGroup, resolveMembers, user?.uid])

  // ── Load user's groups (real-time) ─────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setGroups([])
      setActiveGroup(null)
      setMembers([])
      setExpenses([])
      setSettlements([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid)
    )

    const unsub = onSnapshot(q, async (snap) => {
      const gs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      gs.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0)
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0)
        return tB - tA
      })
      setGroups(gs)

      if (gs.length === 0) {
        // Auto seed default initial group if user has no groups yet
        if (!isSeedingRef.current) {
          isSeedingRef.current = true
          try {
            const userName = user.displayName || (user.email ? user.email.split('@')[0] : 'User')
            await seedInitialData(user.uid, userName)
          } catch (e) {
            console.error('Auto seeding failed:', e)
            setActiveGroup(null)
            setMembers([])
            setExpenses([])
            setSettlements([])
            setLoading(false)
          } finally {
            isSeedingRef.current = false
          }
        }
        return
      }

      // Auto-select: prefer saved group ID for this user, else most recent
      const savedKey = `expense_tracker_group_${user.uid}`
      const savedId  = localStorage.getItem(savedKey) || localStorage.getItem('expense_tracker_group')
      const found    = gs.find((g) => g.id === savedId) || gs[0]

      if (found) {
        await selectGroup(found)
      }
    }, (err) => {
      console.warn('Groups listener error:', err)
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

    // Only show loading if there is no data in memory
    if (expensesRef.current.length === 0) {
      setLoading(true)
    }

    const q = query(
      collection(db, 'groups', activeGroup.id, 'expenses'),
      orderBy('date', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setExpenses(fetched)
      setLoading(false)
    }, (err) => {
      console.warn('Expenses listener error:', err)
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
    }, (err) => {
      console.warn('Settlements listener error:', err)
    })

    return unsub
  }, [activeGroup?.id])

  // ── Refresh active group (called after mutations) ──────────
  const refreshGroup = useCallback(async () => {
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
  }, [activeGroup?.id, resolveMembers])

  // ── Optimistic UI Helpers ──────────────────────────────────
  const optimisticAddExpense = useCallback((newExpense) => {
    setExpenses((prev) => [newExpense, ...prev])
  }, [])

  const optimisticUpdateExpense = useCallback((id, updatedFields) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updatedFields } : e))
    )
  }, [])

  const optimisticDeleteExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const optimisticAddSettlement = useCallback((newSettlement) => {
    setSettlements((prev) => [newSettlement, ...prev])
  }, [])

  const optimisticDeleteSettlement = useCallback((id) => {
    setSettlements((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const optimisticAddGuestMember = useCallback((guest) => {
    setMembers((prev) => [...prev, { id: guest.id, name: guest.name, isGuest: true }])
    setActiveGroup((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        guestMembers: [...(prev.guestMembers || []), guest],
      }
    })
  }, [])

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
    userProfileCache,
    optimisticAddExpense,
    optimisticUpdateExpense,
    optimisticDeleteExpense,
    optimisticAddSettlement,
    optimisticDeleteSettlement,
    optimisticAddGuestMember,
  }

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroup() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroup must be used within GroupProvider')
  return ctx
}
