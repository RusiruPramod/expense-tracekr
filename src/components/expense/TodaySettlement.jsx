/**
 * src/components/expense/TodaySettlement.jsx
 *
 * Real-time "Today's Settlement" card for the Home page.
 *
 * Shows:
 * 1. Current date header (YYYY/MM/DD)
 * 2. Today's total spend
 * 3. Per-member breakdown: paid, share, net balance (cumulative up to today)
 * 4. Settlement actions: who → pays → whom, with 1-click Settle & WhatsApp share
 * 5. Direct shortcut to Full Finalize Summary page
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Users,
  Wallet,
  CreditCard,
  Share2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import { SettleSheet } from '../people/SettleSheet'
import {
  calculateCumulativeMemberSummary,
  calculateBalancesFlat,
  simplifyDebts,
} from '../../lib/calculations'
import { formatCurrency } from '../../lib/format'
import { getCurrentLang } from '../../lib/i18n'

function filterExpensesForDate(expenses, targetDate) {
  const dateStr = format(targetDate, 'yyyy-MM-dd')
  return (expenses || []).filter((e) => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return format(d, 'yyyy-MM-dd') === dateStr
  })
}

export function TodaySettlement({ now = new Date() }) {
  const navigate = useNavigate()
  const lang = getCurrentLang()
  const { user } = useAuth()
  const { expenses, settlements, members, activeGroup } = useGroup()

  const currency = activeGroup?.currency || 'LKR'
  const [settleTarget, setSettleTarget] = useState(null)

  // Today's expenses only (for the "today spent" count)
  const todayExpenses = useMemo(
    () => filterExpensesForDate(expenses, now),
    [expenses, now]
  )

  const todayTotal = useMemo(
    () => todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [todayExpenses]
  )

  // Cumulative summary up to now (includes past unpaid dues rolling forward!)
  const cumulativeData = useMemo(() => {
    if (!user?.uid) return null
    return calculateCumulativeMemberSummary(
      expenses,
      settlements,
      members,
      user.uid,
      now
    )
  }, [expenses, settlements, members, user?.uid, now])

  // Today's per-member breakdown (today only)
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

  const settlementFlow = cumulativeData?.simplifiedSettlements || []
  const memberSummaries = cumulativeData?.memberSummaries?.filter((m) => !m.isUser) || []

  // Net position for current user
  const yourNet = useMemo(() => {
    const receive = cumulativeData?.totalToCollectFromMembers || 0
    const pay = cumulativeData?.totalUserOwesMembers || 0
    return { receive, pay, net: receive - pay }
  }, [cumulativeData])

  const handleWhatsAppShare = (m) => {
    const dateFormatted = format(now, 'yyyy-MM-dd')
    const amountStr = formatCurrency(m.amountDueToUser, currency)
    const isSin = lang === 'si'

    const message = isSin
      ? `ආයුබෝවන් ${m.name},\nSplitly සාරාංශය අනුව අද (${dateFormatted}) දක්වා ඔබේ ගෙවීමට ඇති මුළු මුදල: *${amountStr}* කි. කරුණාකර හැකි ඉක්මනින් පියවන්න.`
      : `Hi ${m.name},\nYour total outstanding balance in Splitly as of ${dateFormatted} is *${amountStr}*. Please settle when convenient.`

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (!activeGroup || members.length === 0) return null

  const hasData = todayExpenses.length > 0 || settlementFlow.length > 0

  return (
    <div className="px-3 sm:px-4 md:px-0 py-2">
      <div className="rounded-2xl border border-gray-200/90 bg-white shadow-xs overflow-hidden">

        {/* ── Header: Today's Date + Total + Full Summary Link ── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/90">
              <Wallet size={16} />
            </div>
            <div>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
                {lang === 'si' ? 'අද දින සාරාංශය' : 'Today Settlement'} · {format(now, 'yyyy/MM/dd')}
              </p>
              <p className="text-xs sm:text-sm font-extrabold text-white">
                {lang === 'si' ? 'අද වියදම:' : 'Today Spent:'}{' '}
                <span className="tabular-nums text-white amount-display">{formatCurrency(todayTotal, currency)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {yourNet.net > 0.009 ? (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <TrendingUp size={11} /> +{formatCurrency(yourNet.receive, currency)}
              </span>
            ) : yourNet.net < -0.009 ? (
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <TrendingDown size={11} /> -{formatCurrency(yourNet.pay, currency)}
              </span>
            ) : (
              <span className="bg-white/10 text-white/70 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle2 size={11} /> Settled
              </span>
            )}
          </div>
        </div>

        {!hasData ? (
          <div className="px-4 py-5 text-center bg-gray-50/50">
            <p className="text-xs text-gray-500 font-medium">No expenses recorded for today yet</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Add expenses to see the live date-wise breakdown and member balances
            </p>
          </div>
        ) : (
          <>
            {/* ── Today's Expenses Breakdown ── */}
            {todayExpenses.length > 0 && (
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-gray-400" />
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      {lang === 'si' ? 'අද දින සාමාජික බෙදීම' : "Today's Member Split"}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {todayExpenses.length} entry(s)
                  </span>
                </div>

                <div className="space-y-1">
                  {todayMemberBreakdown
                    .filter((m) => m.paid > 0 || m.share > 0)
                    .map((m) => {
                      const net = m.paid - m.share
                      const isYou = m.id === user?.uid
                      return (
                        <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-none">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            isYou ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {(isYou ? 'Y' : m.name?.[0] || '?').toUpperCase()}
                          </div>

                          <span className={`text-xs font-semibold flex-1 truncate ${
                            isYou ? 'text-blue-700' : 'text-gray-800'
                          }`}>
                            {isYou ? 'You' : m.name}
                          </span>

                          <div className="flex items-center gap-2.5 text-[11px] tabular-nums">
                            <span className="text-gray-500">
                              <span className="text-[9px] text-gray-400 uppercase mr-0.5">paid</span>
                              {formatCurrency(m.paid, currency)}
                            </span>
                            <span className="text-gray-500">
                              <span className="text-[9px] text-gray-400 uppercase mr-0.5">share</span>
                              {formatCurrency(m.share, currency)}
                            </span>
                          </div>

                          <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                            net > 0.009
                              ? 'bg-emerald-50 text-emerald-700'
                              : net < -0.009
                              ? 'bg-rose-50 text-rose-700'
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

            {/* ── Cumulative Member Dues Section ── */}
            {memberSummaries.length > 0 && (
              <div className="px-4 pt-2.5 pb-3 border-t border-dashed border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    {lang === 'si' ? 'අද වන විට ලැබිය යුතු/ගෙවිය යුතු ශේෂයන්' : 'Running Balances as of Today'}
                  </p>
                  <button
                    onClick={() => navigate('/summary')}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    <span>{lang === 'si' ? 'සම්පූර්ණ සාරාංශය' : 'Full Summary'}</span>
                    <ChevronRight size={12} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {memberSummaries
                    .filter((m) => m.status !== 'settled')
                    .slice(0, 4)
                    .map((m) => {
                      const owesYou = m.status === 'owes_user'
                      const amount = owesYou ? m.amountDueToUser : m.amountOwedByUser

                      return (
                        <div
                          key={m.memberId}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${
                            owesYou
                              ? 'bg-amber-50/70 border-amber-200/80 text-amber-900'
                              : 'bg-rose-50/70 border-rose-200/80 text-rose-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="font-bold truncate">{m.name}</span>
                            <span className="text-[10px] font-semibold opacity-75">
                              {owesYou ? 'owes you' : 'you owe'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black tabular-nums amount-display">
                              {formatCurrency(amount, currency)}
                            </span>

                            {/* Quick WhatsApp Reminder */}
                            {owesYou && (
                              <button
                                onClick={() => handleWhatsAppShare(m)}
                                className="p-1 rounded-lg hover:bg-amber-100 text-emerald-700"
                                title="Send WhatsApp reminder"
                              >
                                <Share2 size={12} />
                              </button>
                            )}

                            {/* Quick Settle Button */}
                            <button
                              onClick={() =>
                                setSettleTarget({
                                  person: { id: m.memberId, name: m.name },
                                  amount,
                                  direction: owesYou ? 'they_pay' : 'i_pay',
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-gray-900 hover:bg-black text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                            >
                              <CreditCard size={10} />
                              <span>Settle</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}

                  {memberSummaries.filter((m) => m.status !== 'settled').length === 0 && (
                    <div className="py-2 text-center text-xs text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>All member accounts are fully settled up to today!</span>
                    </div>
                  )}
                </div>

                {/* Footer action */}
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 font-medium">
                    {lang === 'si' ? 'කලින් නොගෙවූ ගණන් ස්වයංක්‍රීයව අදට එකතු වේ' : 'Past unsettled balances carry forward'}
                  </span>
                  <button
                    onClick={() => navigate('/summary')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline"
                  >
                    {lang === 'si' ? 'අවසන් සාරාංශය බලන්න →' : 'View Finalize Page →'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Settle Sheet */}
      {settleTarget && (
        <SettleSheet
          open={!!settleTarget}
          onClose={() => setSettleTarget(null)}
          person={settleTarget.person}
          amount={settleTarget.amount}
          direction={settleTarget.direction}
        />
      )}
    </div>
  )
}

export default TodaySettlement
