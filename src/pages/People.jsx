/**
 * src/pages/People.jsx
 * Balances list — per-person net amounts with settle-up actions.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { Avatar } from '../components/ui/Avatar'
import { SettleSheet } from '../components/people/SettleSheet'
import { SkeletonList } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { calculateBalancesFlat } from '../lib/calculations'
import { formatCurrency } from '../lib/format'

export function People() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { members, expenses, settlements, activeGroup, loading } = useGroup()
  const navigate = useNavigate()

  const currency = activeGroup?.currency || 'LKR'

  const [settleTarget, setSettleTarget] = useState(null) // { person, amount, direction }

  // Build balances substituting ME_PLACEHOLDER → real uid
  const fixedExpenses = useMemo(() =>
    expenses.map((e) => {
      const splitsArray = e.splits || e.splitDetails || []
      return {
        ...e,
        paidBy: e.paidBy === 'ME_PLACEHOLDER' ? user?.uid : e.paidBy,
        splits: splitsArray.map((s) => ({
          ...s,
          memberId: s.memberId === 'ME_PLACEHOLDER' ? user?.uid : s.memberId,
        })),
      }
    }), [expenses, user?.uid])

  const fixedSettlements = useMemo(() =>
    settlements.map((s) => ({
      ...s,
      from: s.from === 'ME_PLACEHOLDER' ? user?.uid : s.from,
      to:   s.to   === 'ME_PLACEHOLDER' ? user?.uid : s.to,
    })), [settlements, user?.uid])

  const balancesFlat = useMemo(
    () => calculateBalancesFlat(fixedExpenses, fixedSettlements),
    [fixedExpenses, fixedSettlements]
  )

  // Build per-person net relative to current user
  const personBalances = useMemo(() => {
    return members
      .filter((m) => m.id !== user?.uid)
      .map((m) => {
        // Find entries that involve both user and this person
        let net = 0
        for (const b of balancesFlat) {
          if (b.from === user?.uid && b.to === m.id)  net -= b.amount
          if (b.from === m.id    && b.to === user?.uid) net += b.amount
        }
        return { member: m, net }
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [members, user?.uid, balancesFlat])

  if (!activeGroup) {
    return (
      <PageLayout>
        <PageHeader title={t('people.title')} />
        <EmptyState
          icon={Users}
          title={t('groups.noGroup')}
          hint={t('groups.noGroupHint')}
          action={() => navigate('/profile')}
          actionLabel={t('groups.create')}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHeader title={t('people.title')} subtitle={activeGroup?.name} />

      {loading ? (
        <SkeletonList count={4} />
      ) : personBalances.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('people.noFriends')}
          hint={t('people.noFriendsHint')}
        />
      ) : (
        <div className="p-4 space-y-2">
          {personBalances.map(({ member, net }) => (
            <PersonRow
              key={member.id}
              member={member}
              net={net}
              currency={currency}
              t={t}
              onSettle={() =>
                setSettleTarget({
                  person:    member,
                  amount:    Math.abs(net),
                  direction: net < 0 ? 'i_pay' : 'they_pay',
                })
              }
              onViewHistory={() => navigate(`/people/${member.id}`)}
            />
          ))}
        </div>
      )}

      {/* Settle sheet */}
      {settleTarget && (
        <SettleSheet
          open={!!settleTarget}
          onClose={() => setSettleTarget(null)}
          person={settleTarget.person}
          amount={settleTarget.amount}
          direction={settleTarget.direction}
        />
      )}
    </PageLayout>
  )
}

function PersonRow({ member, net, currency, t, onSettle, onViewHistory }) {
  const isPositive = net > 0
  const isZero     = Math.abs(net) < 0.01

  return (
    <div
      className="card p-4 flex items-center gap-3 cursor-pointer"
      onClick={onViewHistory}
    >
      <Avatar name={member.name} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{member.name}</p>
        <p className={`text-xs mt-0.5 ${
          isZero      ? 'text-gray-400' :
          isPositive  ? 'text-green-600' : 'text-red-500'
        }`}>
          {isZero
            ? t('people.settled')
            : isPositive
            ? t('people.owesYou')
            : t('people.youOwe')}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className={`text-sm font-bold amount-display ${
          isZero     ? 'text-gray-400' :
          isPositive ? 'text-green-600' : 'text-red-500'
        }`}>
          {isZero ? '—' : formatCurrency(Math.abs(net), currency)}
        </span>

        {!isZero && (
          <button
            onClick={(e) => { e.stopPropagation(); onSettle() }}
            className="chip chip-blue active text-xs py-1 px-3 min-h-[28px]"
          >
            {t('settle.title')}
          </button>
        )}
      </div>
    </div>
  )
}
