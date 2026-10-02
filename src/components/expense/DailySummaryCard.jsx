/**
 * src/components/expense/DailySummaryCard.jsx
 * Daily end-of-day calculation & summary table card.
 * Light UI/UX theme with clean contrast and clear readability.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import { calculateDailySummary } from '../../lib/calculations'

export function DailySummaryCard({ dayExpenses, members, currency = 'LKR' }) {
  const [open, setOpen] = useState(false)

  const summary = calculateDailySummary(dayExpenses, members)

  return (
    <div className="mx-4 my-2.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-slate-50/90 border border-blue-100/90 p-3.5 shadow-sm text-gray-900">
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Calculator size={17} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-950 tracking-wide uppercase">
              End of Day Summary
            </h4>
            <p className="text-xs text-gray-600">
              Total Spent: <span className="font-bold text-gray-900 amount-display">{formatCurrency(summary.totalAmount, currency)}</span>
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-white hover:bg-blue-100/60 border border-blue-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors">
          <span>{open ? 'Hide' : 'Daily Breakdown'}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-blue-100 space-y-2 text-xs">
          <div className="grid grid-cols-4 font-bold text-gray-400 pb-1.5 border-b border-blue-100/80 text-[10px] uppercase tracking-wider">
            <span>Person</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Owes</span>
            <span className="text-right">Net</span>
          </div>

          {summary.memberSummaries.map((m) => {
            const isReceive = m.status === 'receive'
            const isPay     = m.status === 'pay'

            return (
              <div key={m.memberId} className="grid grid-cols-4 items-center text-gray-800 py-1.5 border-b border-blue-50/60 last:border-none">
                <span className="font-semibold text-gray-900 truncate pr-1">{m.name}</span>
                <span className="text-right amount-display text-gray-700 font-medium">
                  {formatCurrency(m.paid, currency)}
                </span>
                <span className="text-right amount-display text-gray-700 font-medium">
                  {formatCurrency(m.owes, currency)}
                </span>
                <span className="text-right font-bold amount-display">
                  {m.status === 'settled' ? (
                    <span className="inline-block text-gray-400 text-[11px]">0.00</span>
                  ) : isReceive ? (
                    <span className="inline-block text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200/80 text-[11px] font-bold">
                      + {formatCurrency(m.net, currency)}
                    </span>
                  ) : (
                    <span className="inline-block text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-200/80 text-[11px] font-bold">
                      - {formatCurrency(Math.abs(m.net), currency)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}

          <p className="text-[10px] text-gray-500 italic pt-1 text-center font-medium">
            💡 (+) Receives money | (-) Pays money for this day
          </p>
        </div>
      )}
    </div>
  )
}
