/**
 * src/hooks/useExpenses.js
 * CRUD operations for expenses and settlements.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'

export function useExpenses() {
  const { user } = useAuth()
  const { activeGroup } = useGroup()

  const expensesRef = () =>
    collection(db, 'groups', activeGroup.id, 'expenses')

  const settlementsRef = () =>
    collection(db, 'groups', activeGroup.id, 'settlements')

  /**
   * Add a new expense.
   * @param {object} data
   */
  const addExpense = async (data) => {
    if (!activeGroup?.id || !user?.uid) throw new Error('No active group')

    const { date, ...rest } = data
    const dateTs = date
      ? Timestamp.fromDate(new Date(date))
      : Timestamp.now()

    await addDoc(expensesRef(), {
      ...rest,
      date:      dateTs,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    })
  }

  /**
   * Update an existing expense.
   * @param {string} id
   * @param {object} data
   */
  const updateExpense = async (id, data) => {
    const { date, ...rest } = data
    const dateTs = date
      ? Timestamp.fromDate(new Date(date))
      : undefined

    const ref = doc(db, 'groups', activeGroup.id, 'expenses', id)
    await updateDoc(ref, {
      ...rest,
      ...(dateTs ? { date: dateTs } : {}),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    })
  }

  /**
   * Delete an expense.
   * @param {string} id
   */
  const deleteExpense = async (id) => {
    const ref = doc(db, 'groups', activeGroup.id, 'expenses', id)
    await deleteDoc(ref)
  }

  /**
   * Record a settlement.
   * @param {object} data
   */
  const addSettlement = async (data) => {
    const { date, ...rest } = data
    const dateTs = date
      ? Timestamp.fromDate(new Date(date))
      : Timestamp.now()

    await addDoc(settlementsRef(), {
      ...rest,
      date:      dateTs,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
  }

  /**
   * Delete a settlement.
   * @param {string} id
   */
  const deleteSettlement = async (id) => {
    const ref = doc(db, 'groups', activeGroup.id, 'settlements', id)
    await deleteDoc(ref)
  }

  return { addExpense, updateExpense, deleteExpense, addSettlement, deleteSettlement }
}
