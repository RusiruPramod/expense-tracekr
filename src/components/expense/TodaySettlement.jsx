/**
 * src/components/expense/TodaySettlement.jsx
 *
 * Professional "Today's Settlement" card.
 * Royal blue header · clean white body · clear typography hierarchy.
 * Same calculation logic — UI/UX redesigned.
 */

import { useState, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Share2, ChevronRight, ArrowUpRight } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import { SettleSheet } from '../people/SettleSheet'
import { calculateCumulativeMemberSummary } from '../../lib/calculations'
import { formatCurrency } from '../../lib/format'
import { getCurrentLang } from '../../lib/i18n'

function filterExpensesForDate(expenses, targetDate) {
  const dateStr = format(targetDate, 'yyyy-MM-dd')
  return (expenses || []).filter((e) => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return format(d, 'yyyy-MM-dd') === dateStr
  })
}

function TodaySettlementComponent({ now = new Date() }) {
  const navigate  = useNavigate()
  const lang      = getCurrentLang()
  const { user }  = useAuth()
  const { expenses, settlements, members, activeGroup } = useGroup()

  const currency = activeGroup?.currency || 'LKR'
  const [settleTarget, setSettleTarget] = useState(null)

  /* ── Calculations (unchanged) ─────────────────────────────── */
  const todayExpenses = useMemo(
    () => filterExpensesForDate(expenses, now),
    [expenses, now]
  )
  const todayTotal = useMemo(
    () => todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [todayExpenses]
  )

  const cumulativeData = useMemo(() => {
    if (!user?.uid) return null
    return calculateCumulativeMemberSummary(
      expenses, settlements, members, user.uid, now
    )
  }, [expenses, settlements, members, user?.uid, now])

  const memberSummaries = cumulativeData?.memberSummaries?.filter((m) => !m.isUser) || []
  const pendingMembers  = memberSummaries.filter((m) => m.status !== 'settled')

  const yourNet = useMemo(() => {
    const receive = cumulativeData?.totalToCollectFromMembers || 0
    const pay     = cumulativeData?.totalUserOwesMembers || 0
    return { receive, pay, net: receive - pay }
  }, [cumulativeData])

  const handleWhatsAppShare = (m) => {
    const dateFormatted = format(now, 'yyyy-MM-dd')
    const amountStr     = formatCurrency(m.amountDueToUser, currency)
    const isSin         = lang === 'si'
    const message = isSin
      ? `ආයුබෝවන් ${m.name},\nSplitly සාරාංශය අනුව අද (${dateFormatted}) දක්වා ඔබේ ගෙවීමට ඇති මුළු මුදල: *${amountStr}* කි. කරුණාකර හැකි ඉක්මනින් පියවන්න.`
      : `Hi ${m.name},\nYour total outstanding balance as of ${dateFormatted} is *${amountStr}*. Please settle when convenient.`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  if (!activeGroup || members.length === 0) return null

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="px-3 sm:px-4 md:px-0 py-2">
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #e0e7ff', background: '#fff' }}>

        {/* ════ HEADER — Royal Blue ════ */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* Left: title + date + today spent */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                {lang === 'si' ? 'අද දින සාරාංශය' : 'Today Settlement'} &nbsp;·&nbsp; {format(now, 'dd MMM yyyy')}
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                {lang === 'si' ? 'අද වියදම:' : 'Today Spent:'}
                &nbsp;
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(todayTotal, currency)}</span>
              </p>
            </div>

            {/* Right: net badge */}
            {yourNet.net > 0.009 ? (
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 10px', border: '1px solid rgba(255,255,255,0.25)', textAlign: 'right' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>To Collect</p>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  +{formatCurrency(yourNet.receive, currency)}
                </p>
              </div>
            ) : yourNet.net < -0.009 ? (
              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 10px', border: '1px solid rgba(255,80,80,0.35)', textAlign: 'right' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,200,200,0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>You Owe</p>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#fca5a5', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  -{formatCurrency(yourNet.pay, currency)}
                </p>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', margin: 0 }}>✓ All Clear</p>
              </div>
            )}
          </div>
        </div>

        {/* ════ BODY ════ */}
        {memberSummaries.length > 0 ? (
          <div style={{ padding: '0 16px' }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                {lang === 'si' ? 'අද වන විට ශේෂ' : 'Running Balances as of Today'}
              </p>
              <button
                onClick={() => navigate('/summary')}
                style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {lang === 'si' ? 'සම්පූර්ණ' : 'Full Summary'}
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Member rows */}
            <div>
              {pendingMembers.slice(0, 5).map((m, idx) => {
                const owesYou = m.status === 'owes_user'
                const amount  = owesYou ? m.amountDueToUser : m.amountOwedByUser
                const isLast  = idx === Math.min(pendingMembers.length, 5) - 1

                return (
                  <div
                    key={m.memberId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 0',
                      borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                    }}
                  >
                    {/* Avatar initial */}
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: '#eff6ff', border: '1.5px solid #bfdbfe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#1d4ed8', flexShrink: 0,
                    }}>
                      {m.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* Name + label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
                        {m.name}
                      </p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: owesYou ? '#4b5563' : '#9ca3af', margin: '1px 0 0' }}>
                        {owesYou
                          ? (lang === 'si' ? 'ඔබට ගෙවිය යුතුය' : 'owes you')
                          : (lang === 'si' ? 'ඔබ ගෙවිය යුතුය' : 'you owe')}
                      </p>
                    </div>

                    {/* Amount */}
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', margin: 0, flexShrink: 0 }}>
                      {formatCurrency(amount, currency)}
                    </p>

                    {/* WhatsApp share */}
                    {owesYou && (
                      <button
                        onClick={() => handleWhatsAppShare(m)}
                        title="Send WhatsApp reminder"
                        style={{
                          width: 30, height: 30, borderRadius: 8,
                          border: '1px solid #e5e7eb', background: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0, color: '#6b7280',
                        }}
                      >
                        <Share2 size={13} />
                      </button>
                    )}

                    {/* Settle button */}
                    <button
                      onClick={() =>
                        setSettleTarget({
                          person:    { id: m.memberId, name: m.name },
                          amount,
                          direction: owesYou ? 'they_pay' : 'i_pay',
                        })
                      }
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: '#1d4ed8',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                        letterSpacing: '0.01em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Settle
                    </button>
                  </div>
                )
              })}

              {/* All settled state */}
              {pendingMembers.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#1d4ed8', padding: '10px 0 8px' }}>
                  ✓ All accounts settled up to today
                </p>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', padding: '10px 0 12px' }}>
              <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, margin: 0 }}>
                {lang === 'si' ? 'කලින් නොගෙවූ ගණන් ස්වයංක්‍රීයව අදට එකතු වේ' : 'Past unsettled balances carry forward'}
              </p>
              <button
                onClick={() => navigate('/summary')}
                style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {lang === 'si' ? 'සාරාංශ පිටුව' : 'View Finalize Page'}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        ) : (
          /* No data */
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
              No balances yet. Add an expense to get started.
            </p>
          </div>
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

export const TodaySettlement = memo(TodaySettlementComponent)
export default TodaySettlement
