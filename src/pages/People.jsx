/**
 * src/pages/People.jsx
 * Balances list — per-person net amounts with settle-up actions and Add Friend feature.
 * Optimized with memoized PersonRow and optimistic friend addition.
 */

import { useState, useMemo, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useGroups } from '../hooks/useGroups'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { Avatar } from '../components/ui/Avatar'
import { SettleSheet } from '../components/people/SettleSheet'
import { BottomSheet } from '../components/ui/BottomSheet'
import { SkeletonList } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { calculateBalancesFlat } from '../lib/calculations'
import { formatCurrency } from '../lib/format'

export function People() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { members, expenses, settlements, activeGroup, loading } = useGroup()
  const { addGuestMember } = useGroups()
  const navigate = useNavigate()

  const currency = activeGroup?.currency || 'LKR'

  const [settleTarget, setSettleTarget] = useState(null) // { person, amount, direction }
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [newFriendName, setNewFriendName] = useState('')
  const [adding, setAdding] = useState(false)

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
        let net = 0
        for (const b of balancesFlat) {
          if (b.from === user?.uid && b.to === m.id)  net -= b.amount
          if (b.from === m.id    && b.to === user?.uid) net += b.amount
        }
        return { member: m, net }
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [members, user?.uid, balancesFlat])

  const handleAddFriend = async (e) => {
    e.preventDefault()
    const name = newFriendName.trim()
    if (!name) return
    if (!activeGroup?.id) {
      toast.error('No active group')
      return
    }

    setAdding(true)
    setNewFriendName('')
    setAddSheetOpen(false)
    toast.success(`Added ${name} to group!`)

    try {
      await addGuestMember(name, activeGroup.id)
    } catch (err) {
      toast.error(err.message || 'Failed to add friend')
    } finally {
      setAdding(false)
    }
  }

  const handleOpenSettle = useCallback((member, net) => {
    setSettleTarget({
      person:    member,
      amount:    Math.abs(net),
      direction: net < 0 ? 'i_pay' : 'they_pay',
    })
  }, [])

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
      <PageHeader
        title={t('people.title')}
        subtitle={activeGroup?.name}
        right={
          <button
            onClick={() => setAddSheetOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            <UserPlus size={15} />
            <span>Add Friend</span>
          </button>
        }
      />

      {/* Quick Add Banner */}
      <div className="px-4 md:px-0 pt-3 pb-1">
        <button
          onClick={() => setAddSheetOpen(true)}
          className="w-full py-2.5 px-3 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs hover:bg-blue-100/70 transition-colors"
        >
          <UserPlus size={16} />
          <span>+ Add New Friend / Member to Group</span>
        </button>
      </div>

      {loading && members.length === 0 ? (
        <SkeletonList count={4} />
      ) : personBalances.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('people.noFriends')}
          hint="Tap + Add New Friend above to add friends to this group."
        />
      ) : (
        <div className="p-4 md:px-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {personBalances.map(({ member, net }) => (
            <PersonRow
              key={member.id}
              member={member}
              net={net}
              currency={currency}
              t={t}
              onSettle={() => handleOpenSettle(member, net)}
            />
          ))}
        </div>
      )}

      {/* Add Friend Sheet */}
      <BottomSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        title="Add Friend to Group"
      >
        <form onSubmit={handleAddFriend} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Friend's Name
            </label>
            <input
              type="text"
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              placeholder="e.g. Amila, Kavinda, Nimal"
              className="input"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Once added, you can immediately select them as the payer or split expenses with them!
            </p>
          </div>

          <button
            type="submit"
            disabled={adding || !newFriendName.trim()}
            className="btn-primary"
          >
            {adding ? 'Adding...' : 'Add Friend'}
          </button>
        </form>
      </BottomSheet>

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

const PersonRow = memo(function PersonRow({ member, net, currency, t, onSettle }) {
  const isPositive = net > 0
  const isZero     = Math.abs(net) < 0.01

  return (
    <div className="card p-4 flex items-center gap-3">
      <Avatar name={member.name} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{member.name}</p>
        <p className={`text-xs mt-0.5 font-medium ${
          isZero      ? 'text-gray-400' :
          isPositive  ? 'text-emerald-600' : 'text-rose-600'
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
          isPositive ? 'text-emerald-600' : 'text-rose-600'
        }`}>
          {isZero ? '—' : formatCurrency(Math.abs(net), currency)}
        </span>

        {!isZero && (
          <button
            onClick={onSettle}
            className="chip chip-blue active text-xs py-1 px-3 min-h-[28px]"
          >
            {t('settle.title')}
          </button>
        )}
      </div>
    </div>
  )
})
