/**
 * src/components/expense/ExpenseForm.jsx
 * The main Add/Edit Expense form — bottom sheet content.
 * Handles all 4 split modes with live preview.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronDown, Check } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import { useExpenses } from '../../hooks/useExpenses'
import { Avatar } from '../ui/Avatar'
import { CategoryChip, CATEGORY_KEYS } from './CategoryIcon'
import {
  computeEqualSplits,
  validateManualSplits,
  computePercentSplits,
  toMinorUnits,
  fromMinorUnits,
} from '../../lib/calculations'
import { formatCurrency } from '../../lib/format'

const SPLIT_MODES = ['equal', 'manual', 'percent', 'individual']

export function ExpenseForm({ onClose, editExpense = null }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { activeGroup, members } = useGroup()
  const { addExpense, updateExpense } = useExpenses()

  const currency = activeGroup?.currency || 'LKR'

  // ── Form state ────────────────────────────────────────────
  const [title,     setTitle]     = useState(editExpense?.title     || '')
  const [amount,    setAmount]    = useState(editExpense?.amount?.toString() || '')
  const [date,      setDate]      = useState(
    editExpense?.date?.toDate
      ? format(editExpense.date.toDate(), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  )
  const [note,      setNote]      = useState(editExpense?.note      || '')
  const [category,  setCategory]  = useState(editExpense?.category  || 'other')
  const [paidBy,    setPaidBy]    = useState(editExpense?.paidBy    || user?.uid || '')
  const [splitMode, setSplitMode] = useState(editExpense?.splitMode || 'equal')
  const [selectedMembers, setSelectedMembers] = useState(
    editExpense?.splits?.map((s) => s.memberId) || (members.length > 0 ? members.map((m) => m.id) : [])
  )
  // Manual split amounts: { memberId: string_amount }
  const [manualAmounts, setManualAmounts] = useState(() => {
    if (editExpense?.splitMode === 'manual') {
      const map = {}
      editExpense.splits.forEach((s) => { map[s.memberId] = s.amount.toString() })
      return map
    }
    return {}
  })
  // Percent splits: { memberId: string_percent }
  const [percentAmounts, setPercentAmounts] = useState(() => {
    if (editExpense?.splitMode === 'percent') {
      const map = {}
      editExpense.splits.forEach((s) => { map[s.memberId] = s.percent?.toString() || '' })
      return map
    }
    return {}
  })
  // Individual: single assignee
  const [individualTarget, setIndividualTarget] = useState(
    editExpense?.splitMode === 'individual' ? editExpense.splits[0]?.memberId : ''
  )

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const totalAmount = parseFloat(amount) || 0

  // ── Computed splits ───────────────────────────────────────
  const computedSplits = useMemo(() => {
    if (selectedMembers.length === 0 || totalAmount === 0) return []

    switch (splitMode) {
      case 'equal':
        return computeEqualSplits(totalAmount, selectedMembers, paidBy)

      case 'manual':
        return selectedMembers.map((id) => ({
          memberId: id,
          amount: parseFloat(manualAmounts[id] || 0),
        }))

      case 'percent':
        return computePercentSplits(
          totalAmount,
          selectedMembers.map((id) => ({
            memberId: id,
            percent: parseFloat(percentAmounts[id] || 0),
          })),
          paidBy
        )

      case 'individual':
        return individualTarget
          ? [{ memberId: individualTarget, amount: totalAmount }]
          : []

      default:
        return []
    }
  }, [splitMode, selectedMembers, totalAmount, paidBy, manualAmounts, percentAmounts, individualTarget])

  // ── Validation ────────────────────────────────────────────
  const { remaining, valid: splitsValid } = useMemo(() => {
    if (splitMode !== 'manual') return { remaining: 0, valid: true }
    return validateManualSplits(totalAmount, computedSplits)
  }, [splitMode, totalAmount, computedSplits])

  const percentSum = useMemo(() => {
    if (splitMode !== 'percent') return 0
    return Object.values(percentAmounts).reduce((acc, v) => acc + (parseFloat(v) || 0), 0)
  }, [splitMode, percentAmounts])

  // ── Member selection ──────────────────────────────────────
  const toggleMember = (id) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedMembers(members.map((m) => m.id))
  }

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}

    if (!title.trim())          errs.title   = t('expense.errors.noTitle')
    if (!amount || totalAmount <= 0) errs.amount = t('expense.errors.noAmount')
    if (selectedMembers.length === 0) errs.members = t('expense.errors.noMembers')
    if (splitMode === 'manual' && !splitsValid) errs.splits = t('expense.errors.splitMismatch')
    if (splitMode === 'percent' && Math.abs(percentSum - 100) > 0.1)
      errs.splits = 'Percentages must sum to 100%'

    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const payload = {
        title:     title.trim(),
        amount:    totalAmount,
        date,
        note:      note.trim(),
        category,
        paidBy,
        splitMode,
        splits:    computedSplits,
      }

      if (editExpense) {
        await updateExpense(editExpense.id, payload)
        toast.success(t('expense.updated'))
      } else {
        await addExpense(payload)
        toast.success(t('expense.saved'))
      }

      onClose()
    } catch (err) {
      console.error(err)
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  const perPersonAmount = selectedMembers.length > 0 && splitMode === 'equal'
    ? fromMinorUnits(Math.floor(toMinorUnits(totalAmount) / selectedMembers.length))
    : 0

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-5 pb-8">

      {/* ── Title ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('expense.title')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('expense.titlePlaceholder')}
          className="input"
          autoFocus
        />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
      </div>

      {/* ── Amount ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('expense.amount')}
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
            {currency === 'LKR' ? 'Rs' : currency}
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input pl-10 text-xl font-bold amount-display"
            min="0"
            step="0.01"
          />
        </div>
        {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
      </div>

      {/* ── Date & Category row ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('expense.date')}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('expense.paidBy')}
          </label>
          <div className="relative">
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="input appearance-none pr-8"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === user?.uid ? t('common.you') : m.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Categories ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_KEYS.map((cat) => (
            <CategoryChip
              key={cat}
              category={cat}
              selected={category === cat}
              onClick={(c) => setCategory(c)}
              label={t(`expense.categories.${cat}`)}
            />
          ))}
        </div>
      </div>

      {/* ── Split members ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            {t('expense.splitBetween')}
          </label>
          <button type="button" onClick={selectAll} className="text-xs text-blue-600 font-medium">
            {t('expense.selectAll')}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {members.map((m) => {
            const sel = selectedMembers.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMember(m.id)}
                className={`flex items-center gap-1.5 chip ${sel ? 'active' : ''}`}
                aria-pressed={sel}
              >
                <Avatar name={m.name} size="xs" />
                <span>{m.id === user?.uid ? t('common.you') : m.name}</span>
                {sel && <Check size={12} />}
              </button>
            )
          })}
        </div>

        {errors.members && <p className="text-xs text-red-500 mt-1">{errors.members}</p>}
      </div>

      {/* ── Split mode ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('expense.splitMode')}
        </label>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {SPLIT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSplitMode(mode)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                splitMode === mode
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t(`expense.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Split preview / inputs ── */}
      {totalAmount > 0 && selectedMembers.length > 0 && (
        <div className="card p-3 space-y-2">

          {/* Equal split preview */}
          {splitMode === 'equal' && (
            <div className="text-center">
              <p className="text-xs text-gray-400">{t('expense.perPerson')}</p>
              <p className="text-2xl font-bold text-gray-900 amount-display">
                {formatCurrency(perPersonAmount, currency)}
              </p>
            </div>
          )}

          {/* Manual split inputs */}
          {splitMode === 'manual' && (
            <div className="space-y-2">
              {selectedMembers.map((id) => {
                const m = members.find((x) => x.id === id)
                return (
                  <div key={id} className="flex items-center gap-3">
                    <Avatar name={m?.name || id} size="xs" />
                    <span className="text-sm flex-1 text-gray-700">
                      {id === user?.uid ? t('common.you') : m?.name}
                    </span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rs</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={manualAmounts[id] || ''}
                        onChange={(e) => setManualAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                        className="input pl-7 py-2 text-sm text-right"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                )
              })}
              <div className={`flex justify-between text-sm font-medium pt-1 border-t border-gray-100 ${
                Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-500'
              }`}>
                <span>{t('expense.remaining')}</span>
                <span>{formatCurrency(remaining, currency)}</span>
              </div>
            </div>
          )}

          {/* Percent split inputs */}
          {splitMode === 'percent' && (
            <div className="space-y-2">
              {selectedMembers.map((id) => {
                const m = members.find((x) => x.id === id)
                return (
                  <div key={id} className="flex items-center gap-3">
                    <Avatar name={m?.name || id} size="xs" />
                    <span className="text-sm flex-1 text-gray-700">
                      {id === user?.uid ? t('common.you') : m?.name}
                    </span>
                    <div className="relative w-20">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={percentAmounts[id] || ''}
                        onChange={(e) => setPercentAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                        className="input py-2 text-sm text-right pr-6"
                        placeholder="0"
                        min="0"
                        max="100"
                        step="1"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">
                      {formatCurrency((totalAmount * (parseFloat(percentAmounts[id]) || 0)) / 100, currency)}
                    </span>
                  </div>
                )
              })}
              <div className={`flex justify-between text-sm font-medium pt-1 border-t border-gray-100 ${
                Math.abs(percentSum - 100) < 0.1 ? 'text-green-600' : 'text-red-500'
              }`}>
                <span>Total %</span>
                <span>{percentSum.toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Individual: pick ONE person */}
          {splitMode === 'individual' && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">Assign full amount to:</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setIndividualTarget(m.id)}
                    className={`chip ${individualTarget === m.id ? 'active' : ''}`}
                  >
                    {m.id === user?.uid ? t('common.you') : m.name}
                    {individualTarget === m.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errors.splits && (
            <p className="text-xs text-red-500">{errors.splits}</p>
          )}
        </div>
      )}

      {/* ── Note ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('expense.note')}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('expense.notePlaceholder')}
          className="input min-h-[72px] resize-none"
          rows={3}
        />
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={saving}
        className="btn-primary"
      >
        {saving ? t('common.loading') : editExpense ? t('expense.update') : t('expense.save')}
      </button>

    </form>
  )
}
