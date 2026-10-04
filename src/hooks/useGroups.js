/**
 * src/hooks/useGroups.js
 * Group management: create, join, add/remove members with optimistic updates.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { generateGuestId } from '../lib/format'

export function useGroups() {
  const { user } = useAuth()
  const { refreshGroup, selectGroup, optimisticAddGuestMember } = useGroup()

  /**
   * Create a new group with the current user as the first member.
   */
  const createGroup = async ({ name, currency = 'LKR' }) => {
    if (!user?.uid) throw new Error('Not authenticated')

    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()

    const ref = await addDoc(collection(db, 'groups'), {
      name,
      currency,
      memberIds:    [user.uid],
      guestMembers: [],
      createdBy:    user.uid,
      createdAt:    serverTimestamp(),
      inviteCode,
    })

    const snap  = await getDoc(ref)
    const group = { id: ref.id, ...snap.data() }
    await selectGroup(group)
    return group
  }

  /**
   * Join a group by invite code.
   */
  const joinGroupByCode = async (code) => {
    const q = query(collection(db, 'groups'), where('inviteCode', '==', code.toUpperCase()))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error('Group not found')

    const groupDoc = snap.docs[0]
    await updateDoc(doc(db, 'groups', groupDoc.id), {
      memberIds: arrayUnion(user.uid),
    })

    const group = { id: groupDoc.id, ...groupDoc.data(), memberIds: [...(groupDoc.data().memberIds || []), user.uid] }
    await selectGroup(group)
    return group
  }

  /**
   * Add a registered user by email to the active group.
   */
  const addMemberByEmail = async (email, groupId) => {
    // Look up the user by email
    const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()))
    const snap = await getDocs(q)
    if (snap.empty) throw new Error('No user found with that email. They must sign up first.')

    const newUserId = snap.docs[0].id
    await updateDoc(doc(db, 'groups', groupId), {
      memberIds: arrayUnion(newUserId),
    })
    await refreshGroup()
  }

  /**
   * Add a guest member (no account) to the active group with instant optimistic update.
   */
  const addGuestMember = async (name, groupId) => {
    const guest = { id: generateGuestId(), name: name.trim() }
    
    // Instant optimistic update
    optimisticAddGuestMember?.(guest)

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        guestMembers: arrayUnion(guest),
      })
      // Background sync
      refreshGroup()
      return guest
    } catch (err) {
      refreshGroup()
      throw err
    }
  }

  /**
   * Remove a registered member from the group.
   */
  const removeMember = async (memberId, groupId) => {
    await updateDoc(doc(db, 'groups', groupId), {
      memberIds: arrayRemove(memberId),
    })
    await refreshGroup()
  }

  /**
   * Remove a guest member from the group.
   */
  const removeGuest = async (guest, groupId) => {
    const ref  = doc(db, 'groups', groupId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const guests = (snap.data().guestMembers || []).filter((g) => g.id !== guest.id)
    await updateDoc(ref, { guestMembers: guests })
    await refreshGroup()
  }

  /**
   * Update group settings (name, currency).
   */
  const updateGroup = async (groupId, data) => {
    await updateDoc(doc(db, 'groups', groupId), { ...data, updatedAt: serverTimestamp() })
    await refreshGroup()
  }

  return { createGroup, joinGroupByCode, addMemberByEmail, addGuestMember, removeMember, removeGuest, updateGroup }
}
