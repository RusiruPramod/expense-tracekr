/**
 * src/lib/seed.js
 * Automatic Firestore seeding script to populate initial sample group & expenses.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { generateGuestId } from './format'

export async function seedInitialData(userId, userName = 'You') {
  if (!userId) throw new Error('User ID is required to seed data.')

  // 1. Ensure User Profile exists
  const userRef = doc(db, 'users', userId)
  await setDoc(userRef, {
    name: userName,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })

  // 2. Create Guest Members
  const kasunId = generateGuestId()
  const nimalId = generateGuestId()

  const guestMembers = [
    { id: kasunId, name: 'Kasun' },
    { id: nimalId, name: 'Nimal' },
  ]

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()

  // 3. Create Group
  const groupRef = await addDoc(collection(db, 'groups'), {
    name: 'Close Friends & Daily Expenses',
    currency: 'LKR',
    memberIds: [userId],
    guestMembers,
    createdBy: userId,
    createdAt: serverTimestamp(),
    inviteCode,
  })

  const groupId = groupRef.id
  const expensesRef = collection(db, 'groups', groupId, 'expenses')

  // 4. Sample Expenses
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)

  // Expense 1: Dinner paid by User (4,500 LKR, split 3 ways)
  await addDoc(expensesRef, {
    title: 'Dinner & Drinks',
    amount: 4500,
    paidBy: userId,
    category: 'food',
    date: today,
    splitMode: 'equal',
    splitDetails: [
      { memberId: userId, amount: 1500, isGuest: false },
      { memberId: kasunId, amount: 1500, isGuest: true },
      { memberId: nimalId, amount: 1500, isGuest: true },
    ],
    notes: 'Dinner at Beach Restaurant',
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  // Expense 2: Supermarket paid by Kasun (1,800 LKR, split 3 ways)
  await addDoc(expensesRef, {
    title: 'Supermarket Groceries',
    amount: 1800,
    paidBy: kasunId,
    category: 'groceries',
    date: yesterday,
    splitMode: 'equal',
    splitDetails: [
      { memberId: userId, amount: 600, isGuest: false },
      { memberId: kasunId, amount: 600, isGuest: true },
      { memberId: nimalId, amount: 600, isGuest: true },
    ],
    notes: 'Snacks and soft drinks',
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  // 5. Sample Settlement
  const settlementsRef = collection(db, 'groups', groupId, 'settlements')
  await addDoc(settlementsRef, {
    fromMemberId: kasunId,
    toMemberId: userId,
    amount: 1000,
    date: today,
    notes: 'Partial settlement via Bank Transfer',
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  return { groupId, inviteCode }
}
