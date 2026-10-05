/**
 * src/lib/cleanData.js
 * Utility for cleaning test/mock data from Firestore and resetting to a pristine production state.
 */

import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { createCleanInitialGroup } from './seed'

/**
 * Clean all existing groups, expenses, and settlements for a specific user,
 * and create a single fresh, pristine group ready for production use.
 * 
 * @param {string} userId - Current user UID
 * @param {string} userName - Display name of the user
 * @returns {Promise<{ newGroupId: string }>}
 */
export async function cleanAndResetUserData(userId, userName = 'User') {
  if (!userId) throw new Error('User ID is required to clean data.')

  try {
    // 1. Find all groups where user is a member
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', userId))
    const groupsSnap = await getDocs(q)

    for (const gDoc of groupsSnap.docs) {
      const groupId = gDoc.id

      // 2. Delete all expenses in this group
      try {
        const expSnap = await getDocs(collection(db, 'groups', groupId, 'expenses'))
        const deleteExpPromises = expSnap.docs.map((eDoc) =>
          deleteDoc(doc(db, 'groups', groupId, 'expenses', eDoc.id))
        )
        await Promise.all(deleteExpPromises)
      } catch (err) {
        console.warn(`Could not delete expenses for group ${groupId}:`, err)
      }

      // 3. Delete all settlements in this group
      try {
        const setSnap = await getDocs(collection(db, 'groups', groupId, 'settlements'))
        const deleteSetPromises = setSnap.docs.map((sDoc) =>
          deleteDoc(doc(db, 'groups', groupId, 'settlements', sDoc.id))
        )
        await Promise.all(deleteSetPromises)
      } catch (err) {
        console.warn(`Could not delete settlements for group ${groupId}:`, err)
      }

      // 4. Delete the group doc itself
      try {
        await deleteDoc(doc(db, 'groups', groupId))
      } catch (err) {
        console.warn(`Could not delete group ${groupId}:`, err)
      }
    }

    // 5. Clear all local storage caches related to groups & expenses
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith('splitly_cached_') ||
           key.startsWith('expense_tracker_group') ||
           key.startsWith('splitly_profile_'))
        ) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    } catch {
      // ignore storage errors
    }

    // 6. Create a clean, pristine group with 0 expenses and 0 mock guests
    const cleanGroup = await createCleanInitialGroup(userId, userName)

    return { newGroupId: cleanGroup.groupId }
  } catch (error) {
    console.error('cleanAndResetUserData error:', error)
    throw error
  }
}
