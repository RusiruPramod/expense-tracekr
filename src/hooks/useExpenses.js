/**
 * src/hooks/useExpenses.js
 * CRUD operations for expenses and settlements with optimistic UI updates and deduplication.
 */

import { useRef } from 'react'
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

// Global active mutation guard to prevent duplicate concurrent writes
const pendingOperations = new Set()

export function useExpenses() {
  const { user } = useAuth()
  const {
    activeGroup,
    expenses,
    settlements,
    optimisticAddExpense,
    optimisticUpdateExpense,
    optimisticDeleteExpense,
    optimisticAddSettlement,
    optimisticDeleteSettlement,
  } = useGroup()

  const expensesRef = () => {
    if (!activeGroup?.id) throw new Error('No active group selected')
    return collection(db, 'groups', activeGroup.id, 'expenses')
  }

  const settlementsRef = () => {
    if (!activeGroup?.id) throw new Error('No active group selected')
    return collection(db, 'groups', activeGroup.id, 'settlements')
  }

  /**
   * Add a new expense with instant optimistic UI update.
   * @param {object} data
   */
  const addExpense = async (data) => {
    if (!activeGroup?.id || !user?.uid) throw new Error('No active group')

    // In-flight dedup key (based on title, amount, paidBy, date)
    const opKey = `add_exp_${data.title}_${data.amount}_${data.paidBy}_${data.date || ''}`
    if (pendingOperations.has(opKey)) {
      console.warn('Duplicate addExpense call blocked')
      return
    }
    pendingOperations.add(opKey)

    const { date, ...rest } = data
    const dateObj = date ? new Date(date) : new Date()
    const dateTs = Timestamp.fromDate(dateObj)

    // Generate optimistic temp ID
    const tempId = 'temp_exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    const optimisticRecord = {
      ...rest,
      id: tempId,
      date: dateTs,
      createdBy: user.uid,
      createdAt: dateTs,
      updatedAt: dateTs,
      updatedBy: user.uid,
    }

    // Apply optimistic update immediately
    optimisticAddExpense?.(optimisticRecord)

    try {
      const docRef = await addDoc(expensesRef(), {
        ...rest,
        date:      dateTs,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      // Update temp id with real id in memory if listener hasn't already done so
      optimisticUpdateExpense?.(tempId, { id: docRef.id })
      return docRef.id
    } catch (err) {
      // Rollback optimistic update on failure
      optimisticDeleteExpense?.(tempId)
      throw err
    } finally {
      pendingOperations.delete(opKey)
    }
  }

  /**
   * Update an existing expense with instant optimistic UI update.
   * @param {string} id
   * @param {object} data
   */
  const updateExpense = async (id, data) => {
    if (!activeGroup?.id) throw new Error('No active group')

    const opKey = `update_exp_${id}`
    if (pendingOperations.has(opKey)) return
    pendingOperations.add(opKey)

    const prevRecord = expenses.find((e) => e.id === id)

    const { date, ...rest } = data
    const dateTs = date
      ? Timestamp.fromDate(new Date(date))
      : undefined

    // Apply optimistic update immediately
    optimisticUpdateExpense?.(id, {
      ...rest,
      ...(dateTs ? { date: dateTs } : {}),
      updatedAt: Timestamp.now(),
      updatedBy: user?.uid,
    })

    try {
      const ref = doc(db, 'groups', activeGroup.id, 'expenses', id)
      await updateDoc(ref, {
        ...rest,
        ...(dateTs ? { date: dateTs } : {}),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'user',
      })
    } catch (err) {
      // Rollback to previous state on error
      if (prevRecord) {
        optimisticUpdateExpense?.(id, prevRecord)
      }
      throw err
    } finally {
      pendingOperations.delete(opKey)
    }
  }

  /**
   * Delete an expense with instant optimistic UI update.
   * @param {string} id
   */
  const deleteExpense = async (id) => {
    if (!activeGroup?.id) throw new Error('No active group')

    const opKey = `delete_exp_${id}`
    if (pendingOperations.has(opKey)) return
    pendingOperations.add(opKey)

    const prevRecord = expenses.find((e) => e.id === id)

    // Remove from UI immediately
    optimisticDeleteExpense?.(id)

    try {
      const ref = doc(db, 'groups', activeGroup.id, 'expenses', id)
      await deleteDoc(ref)
    } catch (err) {
      // Rollback on error
      if (prevRecord) {
        optimisticAddExpense?.(prevRecord)
      }
      throw err
    } finally {
      pendingOperations.delete(opKey)
    }
  }

  /**
   * Record a settlement with instant optimistic UI update.
   * @param {object} data
   */
  const addSettlement = async (data) => {
    if (!activeGroup?.id || !user?.uid) throw new Error('No active group')

    const opKey = `add_set_${data.from}_${data.to}_${data.amount}`
    if (pendingOperations.has(opKey)) return
    pendingOperations.add(opKey)

    const { date, ...rest } = data
    const dateObj = date ? new Date(date) : new Date()
    const dateTs = Timestamp.fromDate(dateObj)

    const tempId = 'temp_set_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    const optimisticRecord = {
      ...rest,
      id: tempId,
      date: dateTs,
      createdBy: user.uid,
      createdAt: dateTs,
    }

    optimisticAddSettlement?.(optimisticRecord)

    try {
      const docRef = await addDoc(settlementsRef(), {
        ...rest,
        date:      dateTs,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      return docRef.id
    } catch (err) {
      optimisticDeleteSettlement?.(tempId)
      throw err
    } finally {
      pendingOperations.delete(opKey)
    }
  }

  /**
   * Delete a settlement with instant optimistic UI update.
   * @param {string} id
   */
  const deleteSettlement = async (id) => {
    if (!activeGroup?.id) throw new Error('No active group')

    const opKey = `delete_set_${id}`
    if (pendingOperations.has(opKey)) return
    pendingOperations.add(opKey)

    const prevRecord = settlements.find((s) => s.id === id)

    optimisticDeleteSettlement?.(id)

    try {
      const ref = doc(db, 'groups', activeGroup.id, 'settlements', id)
      await deleteDoc(ref)
    } catch (err) {
      if (prevRecord) {
        optimisticAddSettlement?.(prevRecord)
      }
      throw err
    } finally {
      pendingOperations.delete(opKey)
    }
  }

  return { addExpense, updateExpense, deleteExpense, addSettlement, deleteSettlement }
}
