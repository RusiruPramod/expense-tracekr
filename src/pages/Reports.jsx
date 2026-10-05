/**
 * src/pages/Reports.jsx
 * Monthly Expense & Final Balance Report.
 * Automatically calculates monthly totals, paid vs owed by member, and final settlements.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  CheckCircle2,
  PieChart as PieChartIcon
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { Avatar } from '../components/ui/Avatar'
import { SkeletonList } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { calculateMonthlySummary } from '../lib/calculations'
import { formatCurrency, safeDate } from '../lib/format'

export function ReportsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { expenses, settlements, members, activeGroup, loading } = useGroup()

  const currency = activeGroup?.currency || 'LKR'

  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Filter expenses and settlements for current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)

  const monthExpenses = useMemo(() => {
    return (expenses || []).filter((e) => {
      try {
        const d = safeDate(e.date)
        return d >= monthStart && d <= monthEnd
      } catch {
        return false
      }
    })
  }, [expenses, monthStart, monthEnd])

  const monthSettlements = useMemo(() => {
    return (settlements || []).filter((s) => {
      try {
        const d = safeDate(s.date)
        return d >= monthStart && d <= monthEnd
      } catch {
        return false
      }
    })
  }, [settlements, monthStart, monthEnd])

  // Compute monthly summary
  const summary = useMemo(() => {
    // Map placeholders to real user uid
    const fixedExpenses = monthExpenses.map((e) => ({
      ...e,
      paidBy: e.paidBy === 'ME_PLACEHOLDER' ? user?.uid : e.paidBy,
      splits: (e.splits || e.splitDetails || []).map((s) => ({
        ...s,
        memberId: s.memberId === 'ME_PLACEHOLDER' ? user?.uid : s.memberId,
      })),
    }))

    return calculateMonthlySummary(fixedExpenses, monthSettlements, members)
  }, [monthExpenses, monthSettlements, members, user?.uid])

  // Category breakdown
  const categoryTotals = useMemo(() => {
    const map = {}
    monthExpenses.forEach((e) => {
      const cat = e.category || 'other'
      map[cat] = (map[cat] || 0) + (e.amount || 0)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [monthExpenses])

  return (
    <PageLayout>
      <PageHeader
        title="Monthly Balance & Reports"
        subtitle={format(currentMonth, 'MMMM yyyy')}
      />

      {/* Month Switcher */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : monthExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses for this month"
          hint="Change month or record new expenses to view monthly calculations."
        />
      ) : (
        <div className="p-4 md:px-0 space-y-6 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left Column: Monthly Total & Category Breakdown */}
            <div className="space-y-4">
              {/* 1. Monthly Total Card */}
              <div className="card p-5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                      Monthly Total Spent
                    </p>
                    <h3 className="text-3xl font-black amount-display mt-1">
                      {formatCurrency(summary.totalSpent, currency)}
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <TrendingUp size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-xs text-blue-100 mt-3 font-medium">
                  Recorded across {monthExpenses.length} expense item(s) in {format(currentMonth, 'MMMM yyyy')}
                </p>
              </div>

              {/* 4. Category Breakdown */}
              {categoryTotals.length > 0 && (
                <div className="card p-4 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                    <PieChartIcon size={16} className="text-indigo-600" />
                    Category Spending
                  </h3>

                  <div className="space-y-3">
                    {categoryTotals.map(([cat, amt]) => {
                      const pct = Math.round((amt / summary.totalSpent) * 100)
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-gray-700">
                            <span className="capitalize">{cat}</span>
                            <span className="amount-display">
                              {formatCurrency(amt, currency)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Monthly Member Breakdown & Settlement Plan */}
            <div className="space-y-4">
              {/* 2. Monthly Member Breakdown Table */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Receipt size={16} className="text-blue-600" />
                    Monthly Final Balance
                  </h3>
                  <span className="text-[11px] text-gray-400 font-medium">End of Month</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-100 text-[11px]">
                        <th className="text-left pb-2 font-semibold">Person</th>
                        <th className="text-right pb-2 font-semibold">Paid</th>
                        <th className="text-right pb-2 font-semibold">Owes</th>
                        <th className="text-right pb-2 font-semibold">Final Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summary.memberSummaries.map((m) => {
                        const isReceive = m.status === 'receive'
                        const isPay     = m.status === 'pay'
                        const isUser    = m.memberId === user?.uid

                        return (
                          <tr key={m.memberId} className="hover:bg-gray-50/50">
                            <td className="py-2.5 pr-2">
                              <div className="flex items-center gap-2">
                                <Avatar name={m.name} size="xs" />
                                <span className="font-semibold text-gray-900 truncate max-w-[90px]">
                                  {m.name} {isUser ? '(You)' : ''}
                                </span>
                              </div>
                            </td>
                            <td className="text-right py-2.5 amount-display text-gray-700">
                              {formatCurrency(m.paid, currency)}
                            </td>
                            <td className="text-right py-2.5 amount-display text-gray-700">
                              {formatCurrency(m.owes, currency)}
                            </td>
                            <td className="text-right py-2.5 font-bold amount-display">
                              {m.status === 'settled' ? (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px]">
                                  Settled
                                </span>
                              ) : isReceive ? (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px]">
                                  + {formatCurrency(m.finalBalance, currency)} (Receives)
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px]">
                                  - {formatCurrency(Math.abs(m.finalBalance), currency)} (Pays)
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Simplified Final Settlement Plan */}
              <div className="card p-4 space-y-3 bg-slate-900 text-white border border-slate-800 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-emerald-400" />
                    Automatic Settlement Plan
                  </h3>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold">
                    Optimized
                  </span>
                </div>

                {summary.simplifiedSettlements.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-400 py-2 text-xs">
                    <CheckCircle2 size={16} />
                    <span>All balances are completely settled for this month!</span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {summary.simplifiedSettlements.map((trans, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-bold text-rose-400">{trans.fromName}</span>
                          <span className="text-gray-400 font-medium">pays</span>
                          <span className="font-bold text-emerald-400">{trans.toName}</span>
                        </div>
                        <span className="font-black text-white amount-display text-sm">
                          {formatCurrency(trans.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </PageLayout>
  )
}

export default ReportsPage
