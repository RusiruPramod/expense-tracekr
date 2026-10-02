/**
 * src/components/expense/DailySummaryCard.jsx
 * Daily end-of-day calculation & summary table card.
 * Rich sleek theme with dark navy card styling.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react'
import { formatCurrency } from '../../lib/format'
import { calculateDailySummary } from '../../lib/calculations'

export function DailySummaryCard({ dayExpenses, members, currency = 'LKR' }) {
  const [open, setOpen] = useState(false)

  const summary = calculateDailySummary(dayExpenses, members)

  return (
    <div className="mx-4 md:mx-0 my-2.5 rounded-2xl bg-slate-50/80 text-slate-900 p-3.5 shadow-2xs border border-slate-200/80">
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
            <Calculator size={17} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-700 tracking-wide uppercase">
              End of Day Summary
            </h4>
            <p className="text-xs text-slate-500">
              Total Spent: <span className="font-bold text-slate-900 amount-display">{formatCurrency(summary.totalAmount, currency)}</span>
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-100 transition-colors">
          <span>{open ? 'Hide' : 'Daily Breakdown'}</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2 text-xs">
          <div className="grid grid-cols-4 font-bold text-slate-400 pb-1.5 border-b border-slate-200/60 text-[10px] uppercase tracking-wider">
            <span>Person</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Owes</span>
            <span className="text-right">Net</span>
          </div>

          {summary.memberSummaries.map((m) => {
            const isReceive = m.status === 'receive'
            const isPay     = m.status === 'pay'

            return (
              <div key={m.memberId} className="grid grid-cols-4 items-center text-slate-700 py-1.5 border-b border-slate-100 last:border-none">
                <span className="font-semibold text-slate-900 truncate pr-1">{m.name}</span>
                <span className="text-right amount-display text-slate-600 font-medium">
                  {formatCurrency(m.paid, currency)}
                </span>
                <span className="text-right amount-display text-slate-600 font-medium">
                  {formatCurrency(m.owes, currency)}
                </span>
                <span className="text-right font-bold amount-display">
                  {m.status === 'settled' ? (
                    <span className="inline-block text-slate-400 text-[11px]">0.00</span>
                  ) : isReceive ? (
                    <span className="inline-block text-emerald-600 font-bold text-[11px]">
                      + {formatCurrency(m.net, currency)}
                    </span>
                  ) : (
                    <span className="inline-block text-rose-600 font-bold text-[11px]">
                      - {formatCurrency(Math.abs(m.net), currency)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}

          <p className="text-[10px] text-slate-400 italic pt-1 text-center font-medium">
            * (+) Receives money | (-) Pays money for this day
          </p>
        </div>
      )}
    </div>
  )
}
