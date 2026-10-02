/**
 * src/components/expense/ExpenseCard.jsx
 * Single ledger entry card. Supports swipe-to-reveal actions.
 */

import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

import { Avatar, AvatarStack } from '../ui/Avatar'
import { CategoryIcon } from './CategoryIcon'
import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import { useExpenses } from '../../hooks/useExpenses'
import { formatCurrency, formatTimestamp } from '../../lib/format'

const SWIPE_THRESHOLD = 72

export function ExpenseCard({ expense, onEdit }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { members, activeGroup } = useGroup()
  const { deleteExpense } = useExpenses()

  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD * 2, -SWIPE_THRESHOLD], [1, 0])
  const editOpacity   = useTransform(x, [SWIPE_THRESHOLD, SWIPE_THRESHOLD * 2], [0, 1])

  const currency = activeGroup?.currency || 'LKR'

  const getMemberName = (id) => {
    const m = members.find((m) => m.id === id)
    return id === user?.uid ? t('common.you') : m?.name || 'Unknown'
  }

  const splitsList = expense.splits || expense.splitDetails || []
  const splitMembers = splitsList.map((s) => members.find((m) => m.id === s.memberId)).filter(Boolean)

  const paidByName = getMemberName(expense.paidBy)

  const handleDragEnd = async (_, info) => {
    const { offset } = info

    if (offset.x < -SWIPE_THRESHOLD) {
      // Delete action
      await handleDelete()
      animate(x, 0, { type: 'spring' })
    } else if (offset.x > SWIPE_THRESHOLD) {
      // Edit action
      onEdit?.(expense)
      animate(x, 0, { type: 'spring' })
    } else {
      animate(x, 0, { type: 'spring' })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('expense.confirmDelete'))) return
    setDeleting(true)
    try {
      await deleteExpense(expense.id)
      toast.success(t('expense.deleted'))
    } catch {
      toast.error(t('toast.error'))
      setDeleting(false)
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right bg (edit) */}
        <motion.div
          style={{ opacity: editOpacity }}
          className="w-16 flex items-center justify-center bg-blue-50"
        >
          <Pencil size={20} className="text-blue-600" />
        </motion.div>

        <div className="flex-1" />

        {/* Left bg (delete) */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="w-16 flex items-center justify-center bg-red-50"
        >
          <Trash2 size={20} className="text-red-500" />
        </motion.div>
      </div>

      {/* Card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -SWIPE_THRESHOLD * 2.5, right: SWIPE_THRESHOLD * 2.5 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="ledger-entry bg-white"
        onClick={() => setExpanded((p) => !p)}
      >
        {/* Category icon */}
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <CategoryIcon category={expense.category} size={17} className="text-gray-500" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{expense.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('expense.paidBy')} {paidByName}
          </p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-sm font-bold text-gray-900 amount-display">
            {formatCurrency(expense.amount, currency)}
          </p>
          <AvatarStack members={splitMembers} max={3} size="xs" />
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 ml-1">
          {expanded
            ? <ChevronUp size={16} className="text-gray-300" />
            : <ChevronDown size={16} className="text-gray-300" />}
        </div>
      </motion.div>

      {/* Expanded split details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-gray-50 border-b border-gray-100 px-4 py-3 space-y-2"
        >
          {splitsList.map((split) => {
            const m = members.find((m) => m.id === split.memberId)
            const name = split.memberId === user?.uid ? t('common.you') : m?.name || 'Unknown'
            return (
              <div key={split.memberId} className="flex items-center gap-2">
                <Avatar name={name} size="xs" />
                <span className="text-xs text-gray-600 flex-1">{name}</span>
                <span className="text-xs font-semibold text-gray-800 amount-display">
                  {formatCurrency(split.amount, currency)}
                </span>
              </div>
            )
          })}

          {expense.note && (
            <p className="text-xs text-gray-400 italic pt-1 border-t border-gray-100">
              {expense.note}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => onEdit?.(expense)}
              className="btn-ghost flex-1 py-2 text-xs"
            >
              <Pencil size={13} /> {t('common.edit')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-ghost flex-1 py-2 text-xs text-red-500 border-red-100"
            >
              <Trash2 size={13} /> {t('common.delete')}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
