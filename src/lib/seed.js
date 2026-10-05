/**
 * src/lib/seed.js
 * Automatic clean group setup for new users.
 * Does NOT insert any mock expenses or fake guests, giving real users a clean slate.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export async function createCleanInitialGroup(userId, userName = 'User') {
  if (!userId) throw new Error('User ID is required.')

  // 1. Ensure User Profile exists with name
  const displayName = userName && userName !== 'User' ? userName : 'User'
  const userRef = doc(db, 'users', userId)
  await setDoc(userRef, {
    name: displayName,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
  const groupName  = `${displayName}'s Group`

  // 2. Create Clean Group with 0 mock expenses and 0 mock guests
  const groupRef = await addDoc(collection(db, 'groups'), {
    name: groupName,
    currency: 'LKR',
    memberIds: [userId],
    guestMembers: [],
    createdBy: userId,
    createdAt: serverTimestamp(),
    inviteCode,
  })

  return { groupId: groupRef.id, inviteCode }
}

/**
 * Kept for backwards compatibility - now creates a clean initial group with NO mock data.
 */
export async function seedInitialData(userId, userName = 'User') {
  return createCleanInitialGroup(userId, userName)
}


