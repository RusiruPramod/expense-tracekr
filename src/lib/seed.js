/**
 * src/lib/seed.js
 * Automatic Firestore seeding script to populate initial sample group & expenses
 * matching the real-world scenario: Rusiru, Sahan, and Kalum.
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

export async function seedInitialData(userId, userName = 'User') {
  if (!userId) throw new Error('User ID is required to seed data.')

  // 1. Ensure User Profile exists with name
  const displayName = userName && userName !== 'User' ? userName : 'User'
  const userRef = doc(db, 'users', userId)
  await setDoc(userRef, {
    name: displayName,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })

  // 2. Create Friends / Guests
  const sahanId = generateGuestId()
  const kalumId = generateGuestId()

  const guestMembers = [
    { id: sahanId, name: 'Sahan' },
    { id: kalumId, name: 'Kalum' },
  ]

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
  const groupName  = `${displayName}'s Expense Group`

  // 3. Create Group
  const groupRef = await addDoc(collection(db, 'groups'), {
    name: groupName,
    currency: 'LKR',
    memberIds: [userId],
    guestMembers,
    createdBy: userId,
    createdAt: serverTimestamp(),
    inviteCode,
  })

  const groupId = groupRef.id
  const expensesRef = collection(db, 'groups', groupId, 'expenses')

  // Sample Dates: 10/01, 10/02, 10/03 of current year/month
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  const date1001 = new Date(year, month, 1, 12, 0, 0)
  const date1002 = new Date(year, month, 2, 14, 30, 0)
  const date1003 = new Date(year, month, 3, 19, 15, 0)

  // Expense 1: 10/01 – Rusiru paid for Food – Rs. 3,000 (Equal split: 1000 each)
  await addDoc(expensesRef, {
    title: 'Food',
    amount: 3000,
    paidBy: userId,
    category: 'food',
    date: date1001,
    splitMode: 'equal',
    splits: [
      { memberId: userId, amount: 1000 },
      { memberId: sahanId, amount: 1000 },
      { memberId: kalumId, amount: 1000 },
    ],
    note: 'Common lunch and food expenses',
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  // Expense 2: 10/02 – Rusiru paid for Shoes – Rs. 2,000 (Rusiru 500, Sahan 1000, Kalum 500)
  await addDoc(expensesRef, {
    title: 'Shoes',
    amount: 2000,
    paidBy: userId,
    category: 'other',
    date: date1002,
    splitMode: 'manual',
    splits: [
      { memberId: userId, amount: 500 },
      { memberId: sahanId, amount: 1000 },
      { memberId: kalumId, amount: 500 },
    ],
    note: 'Footwear & accessories purchase',
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  // Expense 3: 10/03 – Kalum paid for Bites – Rs. 1,000 (Rusiru 100, Sahan 700, Kalum 200)
  await addDoc(expensesRef, {
    title: 'Bites',
    amount: 1000,
    paidBy: kalumId,
    category: 'food',
    date: date1003,
    splitMode: 'manual',
    splits: [
      { memberId: userId, amount: 100 },
      { memberId: sahanId, amount: 700 },
      { memberId: kalumId, amount: 200 },
    ],
    note: 'Evening snacks and bites',
    createdBy: userId,
    createdAt: serverTimestamp(),
  })

  return { groupId, inviteCode }
}

