/**
 * src/components/expense/TodaySettlement.jsx
 *
 * Real-time "Today's Settlement" card for the Home page.
 *
 * Shows:
 * 1. Current date header (YYYY/MM/DD)
 * 2. Today's total spend
 * 3. Per-member breakdown: paid, share, net balance (cumulative up to today)
 * 4. Settlement actions: who → pays → whom, how much
 *
 * All data from Firebase Firestore via GroupContext (real-time onSnapshot).
 * Calculations use the existing calculations.js library (minor-unit safe).
 */

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ArrowRight, TrendingUp, TrendingDown, CheckCircle2, Users, Wallet } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import {
  calculateBalancesFlat,
  simplifyDebts,
  toMinorUnits,
  fromMinorUnits,
} from '../../lib/calculations'
import { formatCurrency } from '../../lib/format'

/**
 * Filters expenses up to and including `targetDate`.
 * This gives a cumulative running total — not just today,
 * but everything before today + today = real balance.
 */
function filterExpensesUpToDate(expenses, targetDate) {
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  return expenses.filter((e) => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return d <= endOfDay
  })
}

function filterExpensesForDate(expenses, targetDate) {
  const dateStr = format(targetDate, 'yyyy-MM-dd')
  return expenses.filter((e) => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return format(d, 'yyyy-MM-dd') === dateStr
  })
}

function filterSettlementsUpToDate(settlements, targetDate) {
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  return settlements.filter((s) => {
    const d = s.date?.toDate ? s.date.toDate() : new Date(s.date)
    return d <= endOfDay
  })
}

export function TodaySettlement({ now }) {
  const { user } = useAuth()
  const { expenses, settlements, members, activeGroup } = useGroup()

  const currency = activeGroup?.currency || 'LKR'

  // ── Today's expenses only (for the "today spent" count) ────────
  const todayExpenses = useMemo(
    () => filterExpensesForDate(expenses, now),
    [expenses, now]
  )

  const todayTotal = useMemo(
    () => todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [todayExpenses]
  )

  // ── Cumulative expenses & settlements up to today ──────────────
  // This is the KEY calculation: it includes ALL past data + today,
  // so the balance is the TRUE running total as of right now.
  const cumulativeExpenses = useMemo(
    () => filterExpensesUpToDate(expenses, now),
    [expenses, now]
  )

  const cumulativeSettlements = useMemo(
    () => filterSettlementsUpToDate(settlements, now),
    [settlements, now]
  )

  // ── Per-member breakdown (today only — paid vs share) ──────────
  const todayMemberBreakdown = useMemo(() => {
    const map = new Map()
    members.forEach((m) =>
      map.set(m.id, { id: m.id, name: m.name, paid: 0, share: 0 })
    )

    for (const exp of todayExpenses) {
      if (map.has(exp.paidBy)) {
        map.get(exp.paidBy).paid += exp.amount || 0
      }
      const splits = exp.splits || exp.splitDetails || []
      for (const s of splits) {
        if (map.has(s.memberId)) {
          map.get(s.memberId).share += s.amount || 0
        }
      }
    }

    return Array.from(map.values())
  }, [todayExpenses, members])

  // ── Cumulative simplified debts (who owes whom as of today) ────
  const settlementFlow = useMemo(() => {
    if (!user?.uid || cumulativeExpenses.length === 0) return []

    const flat = calculateBalancesFlat(cumulativeExpenses, cumulativeSettlements)
    const simplified = simplifyDebts(flat)

    // Map IDs → names
    return simplified
      .filter((t) => t.amount > 0.009)
      .map((t) => {
        const fromMember = members.find((m) => m.id === t.from)
        const toMember = members.find((m) => m.id === t.to)
        return {
          ...t,
          fromName: t.from === user.uid ? 'You' : fromMember?.name || 'Unknown',
          toName: t.to === user.uid ? 'You' : toMember?.name || 'Unknown',
          isYouPay: t.from === user.uid,
          isYouReceive: t.to === user.uid,
        }
      })
  }, [user?.uid, cumulativeExpenses, cumulativeSettlements, members])

  // ── Your net position ─────────────────────────────────────────
  const yourNet = useMemo(() => {
    let receive = 0
    let pay = 0
    for (const flow of settlementFlow) {
      if (flow.isYouReceive) receive += flow.amount
      if (flow.isYouPay) pay += flow.amount
    }
    return { receive, pay, net: receive - pay }
  }, [settlementFlow])

  // Don't render if no group or no members
  if (!activeGroup || members.length === 0) return null

  const hasData = todayExpenses.length > 0 || settlementFlow.length > 0

  return (
    <div className="px-3 sm:px-4 md:px-0 py-3">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* ── Header: Today's Date + Total ── */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Wallet size={16} className="text-white/80" />
            </div>
            <div>
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">
                Settlement · {format(now, 'yyyy/MM/dd')}
              </p>
              <p className="text-sm font-bold text-white">
                Today Spent: <span className="tabular-nums">{formatCurrency(todayTotal, currency)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
            {yourNet.net > 0.009 ? (
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg flex items-center gap-1">
                <TrendingUp size={11} /> You Receive
              </span>
            ) : yourNet.net < -0.009 ? (
              <span className="bg-rose-500/20 text-rose-300 px-2 py-1 rounded-lg flex items-center gap-1">
                <TrendingDown size={11} /> You Pay
              </span>
            ) : (
              <span className="bg-white/10 text-white/60 px-2 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle2 size={11} /> Settled
              </span>
            )}
          </div>
        </div>

        {!hasData ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400 font-medium">No expenses today yet</p>
            <p className="text-[10px] text-gray-300 mt-1">Add an expense to see the settlement flow</p>
          </div>
        ) : (
          <>
            {/* ── Today's Per-Member Breakdown ── */}
            {todayExpenses.length > 0 && (
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={13} className="text-gray-400" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Today's Breakdown
                  </p>
                </div>

                <div className="space-y-1">
                  {todayMemberBreakdown
                    .filter((m) => m.paid > 0 || m.share > 0)
                    .map((m) => {
                      const net = m.paid - m.share
                      const isYou = m.id === user?.uid
                      return (
                        <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-none">
                          {/* Avatar initial */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isYou ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {(isYou ? 'Y' : m.name?.[0] || '?').toUpperCase()}
                          </div>

                          {/* Name */}
                          <span className={`text-xs font-semibold flex-1 truncate ${
                            isYou ? 'text-blue-700' : 'text-gray-800'
                          }`}>
                            {isYou ? 'You' : m.name}
                          </span>

                          {/* Paid / Share */}
                          <div className="flex items-center gap-3 text-[11px] tabular-nums">
                            <span className="text-gray-500">
                              <span className="text-[9px] text-gray-400 uppercase mr-0.5">paid</span>
                              {formatCurrency(m.paid, currency)}
                            </span>
                            <span className="text-gray-500">
                              <span className="text-[9px] text-gray-400 uppercase mr-0.5">share</span>
                              {formatCurrency(m.share, currency)}
                            </span>
                          </div>

                          {/* Net badge */}
                          <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                            net > 0.009
                              ? 'bg-emerald-50 text-emerald-600'
                              : net < -0.009
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-gray-50 text-gray-400'
                          }`}>
                            {net > 0.009 ? '+' : ''}{formatCurrency(net, currency)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* ── Divider ── */}
            {todayExpenses.length > 0 && settlementFlow.length > 0 && (
              <div className="mx-4 border-t border-dashed border-gray-200" />
            )}

            {/* ── Settlement Flow (Cumulative — who owes whom as of today) ── */}
            {settlementFlow.length > 0 && (
              <div className="px-4 pt-3 pb-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                  Current Balance · Who Pays Whom
                </p>

                <div className="space-y-1.5">
                  {settlementFlow.map((flow, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                        flow.isYouPay
                          ? 'bg-rose-50/50 border-rose-100'
                          : flow.isYouReceive
                          ? 'bg-emerald-50/50 border-emerald-100'
                          : 'bg-gray-50/50 border-gray-100'
                      }`}
                    >
                      {/* From */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        flow.isYouPay ? 'bg-rose-100 text-rose-600' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {flow.fromName[0].toUpperCase()}
                      </div>
                      <span className={`text-xs font-semibold truncate ${
                        flow.isYouPay ? 'text-rose-700' : 'text-gray-700'
                      }`}>
                        {flow.fromName}
                      </span>

                      {/* Arrow + Amount */}
                      <div className="flex items-center gap-1 mx-auto">
                        <ArrowRight size={12} className="text-gray-300" />
                        <span className="text-xs font-black text-gray-900 tabular-nums">
                          {formatCurrency(flow.amount, currency)}
                        </span>
                        <ArrowRight size={12} className="text-gray-300" />
                      </div>

                      {/* To */}
                      <span className={`text-xs font-semibold truncate text-right ${
                        flow.isYouReceive ? 'text-emerald-700' : 'text-gray-700'
                      }`}>
                        {flow.toName}
                      </span>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        flow.isYouReceive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {flow.toName[0].toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Your net summary */}
                <div className={`mt-2.5 px-3 py-2 rounded-xl text-center text-xs font-bold ${
                  yourNet.net > 0.009
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : yourNet.net < -0.009
                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                    : 'bg-gray-50 text-gray-500 border border-gray-100'
                }`}>
                  {yourNet.net > 0.009 ? (
                    <>You receive <span className="tabular-nums">{formatCurrency(yourNet.receive, currency)}</span> total</>
                  ) : yourNet.net < -0.009 ? (
                    <>You owe <span className="tabular-nums">{formatCurrency(yourNet.pay, currency)}</span> total</>
                  ) : (
                    <>All settled ✓</>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
