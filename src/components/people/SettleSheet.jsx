/**
 * src/components/people/SettleSheet.jsx
 * Bottom sheet for settling up with a specific person.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronDown } from 'lucide-react'

import { BottomSheet } from '../ui/BottomSheet'
import { Avatar } from '../ui/Avatar'
import { useExpenses } from '../../hooks/useExpenses'
import { useGroup } from '../../context/GroupContext'
import { formatCurrency } from '../../lib/format'

const METHODS = ['cash', 'bank', 'other']

/**
 * SettleSheet
 * @param {boolean}   open
 * @param {() => void} onClose
 * @param {object}    person   { id, name }
 * @param {number}    amount   default amount (positive float)
 * @param {string}    direction  'i_pay' | 'they_pay'
 */
export function SettleSheet({ open, onClose, person, amount, direction }) {
  const { t } = useTranslation()
  const { activeGroup } = useGroup()
  const { addSettlement } = useExpenses()

  const currency = activeGroup?.currency || 'LKR'

  const [settleAmount, setSettleAmount] = useState(
    amount != null && !isNaN(Number(amount)) ? Number(amount).toFixed(2) : ''
  )
  const [method,       setMethod]       = useState('cash')
  const [date,         setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note,         setNote]         = useState('')
  const [saving,       setSaving]       = useState(false)

  const handleConfirm = async () => {
    const val = parseFloat(settleAmount)
    if (!val || val <= 0) { toast.error(t('expense.errors.invalidAmount')); return }

    setSaving(true)
    try {
      // from = who pays, to = who receives
      const fromId = direction === 'i_pay' ? 'ME_PLACEHOLDER' : person.id
      const toId   = direction === 'i_pay' ? person.id        : 'ME_PLACEHOLDER'

      await addSettlement({
        from:   fromId,
        to:     toId,
        amount: val,
        method,
        date,
        note:   note.trim(),
      })

      toast.success(t('settle.settled'))
      onClose()
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  // Generate WhatsApp request text
  const handleRequest = () => {
    const text = t('settle.requestText', {
      name:   person?.name || 'Member',
      amount: formatCurrency(amount || 0, currency),
      count:  '',
    })
    const url  = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('settle.title')}>
      <div className="p-4 space-y-5">

        {/* Person summary */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
          <Avatar name={person?.name || 'Member'} size="md" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{person?.name || 'Member'}</p>
            <p className="text-xs text-gray-400">
              {direction === 'i_pay'
                ? `${t('people.youOwe')} ${formatCurrency(amount || 0, currency)}`
                : `${t('people.owesYou')} ${formatCurrency(amount || 0, currency)}`}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('settle.amount')}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Rs</span>
            <input
              type="number"
              inputMode="decimal"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="input pl-10 text-xl font-bold amount-display"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('settle.method')}
          </label>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  method === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'
                }`}
              >
                {t(`settle.${m}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('settle.date')}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('settle.note')}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('settle.notePlaceholder')}
            className="input"
          />
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? t('common.loading') : t('settle.confirm')}
          </button>

          {direction === 'they_pay' && (
            <button onClick={handleRequest} className="btn-ghost w-full">
              {t('settle.request')}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
