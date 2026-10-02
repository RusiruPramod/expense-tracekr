/**
 * src/components/expense/DailySummaryCard.jsx
 * Daily end-of-day calculation & summary table card.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import { calculateDailySummary } from '../../lib/calculations'

export function DailySummaryCard({ dayExpenses, members, currency = 'LKR' }) {
  const [open, setOpen] = useState(false)

  const summary = calculateDailySummary(dayExpenses, members)

  return (
    <div className="mx-4 my-2 rounded-2xl bg-gradient-to-br from-gray-900 to-slate-900 text-white p-3 shadow-md border border-gray-800">
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Calculator size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-100 tracking-wide uppercase">
              End of Day Summary
            </h4>
            <p className="text-[11px] text-gray-400">
              Total Spent: <span className="font-semibold text-white">{formatCurrency(summary.totalAmount, currency)}</span>
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg transition-colors">
          <span>{open ? 'Hide Breakdown' : 'Daily Breakdown'}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-2 text-xs">
          <div className="grid grid-cols-4 font-semibold text-gray-400 pb-1 border-b border-gray-800 text-[11px]">
            <span>Person</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Owes</span>
            <span className="text-right">Net</span>
          </div>

          {summary.memberSummaries.map((m) => {
            const isReceive = m.status === 'receive'
            const isPay     = m.status === 'pay'

            return (
              <div key={m.memberId} className="grid grid-cols-4 items-center text-gray-200 py-1">
                <span className="font-medium text-white truncate">{m.name}</span>
                <span className="text-right amount-display text-gray-300">
                  {formatCurrency(m.paid, currency)}
                </span>
                <span className="text-right amount-display text-gray-300">
                  {formatCurrency(m.owes, currency)}
                </span>
                <span className="text-right font-bold amount-display">
                  {m.status === 'settled' ? (
                    <span className="text-gray-500">0.00</span>
                  ) : isReceive ? (
                    <span className="text-emerald-400">+ {formatCurrency(m.net, currency)}</span>
                  ) : (
                    <span className="text-rose-400">- {formatCurrency(Math.abs(m.net), currency)}</span>
                  )}
                </span>
              </div>
            )
          })}

          <p className="text-[10px] text-gray-400 italic pt-1 text-center">
            * (+) means Receives money, (-) means Pays money for this day
          </p>
        </div>
      )}
    </div>
  )
}
