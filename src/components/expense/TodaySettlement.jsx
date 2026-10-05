/**
 * src/components/expense/TodaySettlement.jsx
 *
 * "Cumulative Settlement & Running Balance" Card.
 * Calculates all previous days + today rolled forward into a single running total.
 * Shows each individual member's exact payable / receivable amount up to today.
 */

import { useState, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isToday as isDateToday } from 'date-fns'
import { Share2, ChevronRight, ArrowUpRight, CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight as ArrowUpRightIcon } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import { SettleSheet } from '../people/SettleSheet'
import { calculateCumulativeMemberSummary } from '../../lib/calculations'
import { formatCurrency, safeDate } from '../../lib/format'
import { getCurrentLang } from '../../lib/i18n'

function filterExpensesForDate(expenses, targetDate) {
  try {
    const validTarget = safeDate(targetDate)
    const dateStr = format(validTarget, 'yyyy-MM-dd')
    return (expenses || []).filter((e) => {
      try {
        const d = safeDate(e.date)
        return format(d, 'yyyy-MM-dd') === dateStr
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

function TodaySettlementComponent({ now = new Date() }) {
  const navigate  = useNavigate()
  const lang      = getCurrentLang()
  const { user }  = useAuth()
  const { expenses, settlements, members, activeGroup } = useGroup()

  const currency = activeGroup?.currency || 'LKR'
  const [settleTarget, setSettleTarget] = useState(null)

  const isToday = isDateToday(now)

  /* ── Day Expenses (Selected Date Only) ──────────────────────── */
  const dayExpenses = useMemo(
    () => filterExpensesForDate(expenses, now),
    [expenses, now]
  )
  const dayTotal = useMemo(
    () => dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [dayExpenses]
  )

  /* ── Cumulative Data (All previous days up to selected date) ── */
  const cumulativeData = useMemo(() => {
    if (!user?.uid) return null
    return calculateCumulativeMemberSummary(
      expenses, settlements, members, user.uid, now
    )
  }, [expenses, settlements, members, user?.uid, now])

  const allMembers = cumulativeData?.memberSummaries || []
  const cumulativeTotal = cumulativeData?.totalGroupSpent || 0

  const yourNet = useMemo(() => {
    const receive = cumulativeData?.totalToCollectFromMembers || 0
    const pay     = cumulativeData?.totalUserOwesMembers || 0
    return { receive, pay, net: receive - pay }
  }, [cumulativeData])

  const handleWhatsAppShare = (m) => {
    const validNow      = safeDate(now)
    const dateFormatted = format(validNow, 'yyyy-MM-dd')
    const amountStr     = formatCurrency(m.amountDueToUser, currency)
    const isSin         = lang === 'si'
    const message = isSin
      ? `ආයුබෝවන් ${m.name},\nSplitly සාරාංශය අනුව අද (${dateFormatted}) දක්වා ඔබේ ගෙවීමට ඇති මුළු මුදල: *${amountStr}* කි. කරුණාකර හැකි ඉක්මනින් පියවන්න.`
      : `Hi ${m.name},\nYour total outstanding balance as of ${dateFormatted} is *${amountStr}*. Please settle when convenient.`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (!activeGroup || members.length === 0) return null

  const validNow = safeDate(now)

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="px-3 sm:px-4 md:px-0 py-2.5">
      <div className="rounded-2xl overflow-hidden border border-blue-100/80 bg-white shadow-xs">

        {/* ════ HEADER — Deep Royal Blue Gradient ════ */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-4 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            {/* Left: title + totals */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-200/90 bg-white/10 px-2 py-0.5 rounded-md">
                  {isToday
                    ? (lang === 'si' ? 'අද දින දක්වා ශේෂයන්' : 'Running Balances Up to Today')
                    : (lang === 'si' ? `${format(validNow, 'dd MMM yyyy')} දක්වා ශේෂයන්` : `Running Balances as of ${format(validNow, 'dd MMM yyyy')}`)}
                </span>
                <span className="text-xs text-blue-200">
                  {format(validNow, 'yyyy/MM/dd')}
                </span>
              </div>

              {/* Running Total + Day Total */}
              <div className="flex items-baseline gap-4 mt-2">
                <div>
                  <span className="text-[11px] font-medium text-blue-200/80 block">
                    {lang === 'si' ? 'සමස්ත වියදම (සියලු දින):' : 'Cumulative Total (All Days):'}
                  </span>
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
                    {formatCurrency(cumulativeTotal, currency)}
                  </span>
                </div>

                <div className="border-l border-white/20 pl-3">
                  <span className="text-[11px] font-medium text-blue-200/80 block">
                    {isToday
                      ? (lang === 'si' ? 'අද දින වියදම:' : "Today's Spent:")
                      : (lang === 'si' ? 'මෙම දින වියදම:' : "Day's Spent:")}
                  </span>
                  <span className="text-base sm:text-lg font-bold tracking-tight text-blue-100 font-mono">
                    {formatCurrency(dayTotal, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: User's Net Status Badge */}
            <div className="self-start sm:self-auto">
              {yourNet.net > 0.009 ? (
                <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl px-3 py-1.5 text-right">
                  <p className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                    {lang === 'si' ? 'ඔබට ලැබිය යුතු මුදල' : 'You Get Back'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-emerald-200 font-mono">
                    +{formatCurrency(yourNet.receive, currency)}
                  </p>
                </div>
              ) : yourNet.net < -0.009 ? (
                <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl px-3 py-1.5 text-right">
                  <p className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                    {lang === 'si' ? 'ඔබ ගෙවිය යුතු මුදල' : 'You Must Pay'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-rose-200 font-mono">
                    -{formatCurrency(yourNet.pay, currency)}
                  </p>
                </div>
              ) : (
                <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    {lang === 'si' ? 'ඔබගේ ශේෂය බේරා ඇත' : 'All Clear'}
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ════ BODY — Individual Member Breakdown ════ */}
        <div className="px-4 py-3">

          <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                {lang === 'si' ? 'එක් එක් සාමාජිකයාගේ ශේෂයන්' : 'Individual Member Balances'}
              </h4>
              <p className="text-[11px] text-gray-500 font-medium">
                {lang === 'si'
                  ? 'කලින් දිනවල වියදම් එකතු වී එක් එක් අය ගෙවිය යුතු / ලැබිය යුතු මුදල්'
                  : 'Cumulative balance owed / receivable by each person'}
              </p>
            </div>

            <button
              onClick={() => navigate('/summary')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <span>{lang === 'si' ? 'සම්පූර්ණ සාරාංශය' : 'Full Summary'}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Members list showing each person's exact payable amount */}
          <div className="divide-y divide-gray-100">
            {allMembers.map((m) => {
              const owesOverall = m.overallNet < -0.009
              const getsOverall = m.overallNet > 0.009
              const isSettled = !owesOverall && !getsOverall

              const owesYou = m.amountDueToUser > 0.009
              const youOwe = m.amountOwedByUser > 0.009

              return (
                <div key={m.memberId} className="py-2.5 flex items-center justify-between gap-3">
                  
                  {/* Left: Avatar + Name + Paid & Share */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      m.isUser
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {m.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {m.name}
                        </span>
                        {m.isUser && (
                          <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                            {lang === 'si' ? 'ඔබ' : 'You'}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-500 font-medium truncate">
                        {lang === 'si' ? 'ගෙවූ:' : 'Paid:'} {formatCurrency(m.totalPaid, currency)} &nbsp;·&nbsp;
                        {lang === 'si' ? 'කොටස:' : 'Share:'} {formatCurrency(m.totalShare, currency)}
                      </p>
                    </div>
                  </div>

                  {/* Middle / Right: Net Standing Badge */}
                  <div className="text-right shrink-0">
                    {owesOverall ? (
                      <div>
                        <span className="inline-block text-[11px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg font-mono">
                          {lang === 'si' ? 'ගෙවිය යුතුයි:' : 'Must Pay:'} {formatCurrency(Math.abs(m.overallNet), currency)}
                        </span>
                      </div>
                    ) : getsOverall ? (
                      <div>
                        <span className="inline-block text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-mono">
                          {lang === 'si' ? 'ලැබිය යුතුයි:' : 'Gets Back:'} {formatCurrency(m.overallNet, currency)}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="inline-block text-[11px] font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">
                          {lang === 'si' ? 'බේරා ඇත' : 'Settled (Rs. 0)'}
                        </span>
                      </div>
                    )}

                    {/* Direct relation with current user */}
                    {!m.isUser && (owesYou || youOwe) && (
                      <p className="text-[10px] font-medium text-gray-500 mt-0.5">
                        {owesYou
                          ? (lang === 'si' ? `ඔබට ගෙවිය යුතුයි: ${formatCurrency(m.amountDueToUser, currency)}` : `Owes you: ${formatCurrency(m.amountDueToUser, currency)}`)
                          : (lang === 'si' ? `ඔබ ගෙවිය යුතුයි: ${formatCurrency(m.amountOwedByUser, currency)}` : `You owe: ${formatCurrency(m.amountOwedByUser, currency)}`)}
                      </p>
                    )}
                  </div>

                  {/* Right Actions: Settle & WhatsApp (for friends who have unsettled balance with user) */}
                  {!m.isUser && (owesYou || youOwe) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {owesYou && (
                        <button
                          type="button"
                          onClick={() => handleWhatsAppShare(m)}
                          title="WhatsApp Reminder"
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 text-gray-500 transition-colors"
                        >
                          <Share2 size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setSettleTarget({
                            person: { id: m.memberId, name: m.name },
                            amount: owesYou ? m.amountDueToUser : m.amountOwedByUser,
                            direction: owesYou ? 'they_pay' : 'i_pay',
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs"
                      >
                        {lang === 'si' ? 'බේරන්න' : 'Settle'}
                      </button>
                    </div>
                  )}

                </div>
              )
            })}
          </div>

          {/* Footer note */}
          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>
              ℹ️ {lang === 'si'
                ? 'කලින් නොබේරූ හිඟ මුදල් ස්වයංක්‍රීයව අද දිනය දක්වා ඉදිරියට ගණනය වේ.'
                : 'Unsettled balances from previous dates automatically carry forward.'}
            </span>

            <button
              onClick={() => navigate('/summary')}
              className="text-blue-600 font-bold hover:underline shrink-0 ml-2"
            >
              {lang === 'si' ? 'සවිස්තර වාර්තාව' : 'View Full Report'}
            </button>
          </div>

        </div>

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

export const TodaySettlement = memo(TodaySettlementComponent)
export default TodaySettlement

