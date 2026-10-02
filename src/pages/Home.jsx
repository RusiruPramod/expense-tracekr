/**
 * src/pages/Home.jsx
 * Daily ledger — date-wise grouped expense journal with summary cards.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { Search, ChevronLeft, ChevronRight, Filter, SlidersHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { ExpenseCard } from '../components/expense/ExpenseCard'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ExpenseForm } from '../components/expense/ExpenseForm'
import { SkeletonList, SkeletonSummary } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { CATEGORY_KEYS } from '../components/expense/CategoryIcon'
import {
  getPersonBalance,
  calculateBalancesFlat,
} from '../lib/calculations'
import { formatCurrency, smartDateLabel, groupByDate } from '../lib/format'
import { getCurrentLang } from '../lib/i18n'

export function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { expenses, settlements, members, activeGroup, loading } = useGroup()

  const lang = getCurrentLang()
  const currency = activeGroup?.currency || 'LKR'

  const [editExpense, setEditExpense]  = useState(null)
  const [sheetOpen,   setSheetOpen]    = useState(false)
  const [search,      setSearch]       = useState('')
  const [filterCat,   setFilterCat]    = useState('')
  const [filterOpen,  setFilterOpen]   = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // ── Balance summary ───────────────────────────────────────
  const balance = useMemo(() => {
    if (!user?.uid || !expenses.length) return { owed: 0, owes: 0, net: 0 }
    // Replace 'ME_PLACEHOLDER' with actual user ID
    const fixedExpenses = expenses.map((e) => {
      const splitsArray = e.splits || e.splitDetails || []
      return {
        ...e,
        paidBy: e.paidBy === 'ME_PLACEHOLDER' ? user.uid : e.paidBy,
        splits: splitsArray.map((s) => ({
          ...s,
          memberId: s.memberId === 'ME_PLACEHOLDER' ? user.uid : s.memberId,
        })),
      }
    })
    const fixedSettlements = settlements.map((s) => ({
      ...s,
      from: s.from === 'ME_PLACEHOLDER' ? user.uid : s.from,
      to:   s.to   === 'ME_PLACEHOLDER' ? user.uid : s.to,
    }))
    return getPersonBalance(user.uid, fixedExpenses, fixedSettlements)
  }, [user?.uid, expenses, settlements])

  // ── Filter by month ───────────────────────────────────────
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
      if (d < monthStart || d > monthEnd) return false
      if (filterCat && e.category !== filterCat) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.title.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [expenses, monthStart, monthEnd, filterCat, search])

  // ── Group by date ─────────────────────────────────────────
  const grouped = useMemo(() => groupByDate(filteredExpenses), [filteredExpenses])
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

  const handleEdit = (expense) => {
    setEditExpense(expense)
    setSheetOpen(true)
  }

  const handleCloseSheet = () => {
    setSheetOpen(false)
    setEditExpense(null)
  }

  return (
    <PageLayout>
      {/* ── Header ── */}
      <PageHeader
        title={activeGroup?.name || t('home.title')}
        subtitle={format(currentMonth, 'MMMM yyyy')}
        right={
          <button
            onClick={() => setFilterOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label={t('home.filter')}
          >
            <SlidersHorizontal size={19} className="text-gray-600" />
          </button>
        }
      />

      {/* ── Month switcher ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* ── Balance summary cards ── */}
      {loading ? (
        <SkeletonSummary />
      ) : (
        <div className="grid grid-cols-3 gap-2.5 p-4">
          <SummaryCard
            label={t('home.owed')}
            amount={balance.owed}
            type="credit"
            currency={currency}
          />
          <SummaryCard
            label={t('home.owes')}
            amount={balance.owes}
            type="debit"
            currency={currency}
          />
          <SummaryCard
            label={t('home.net')}
            amount={balance.net}
            type={balance.net >= 0 ? 'credit' : 'debit'}
            currency={currency}
          />
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('home.search')}
            className="input pl-9 text-sm py-2.5 min-h-[40px]"
          />
        </div>
      </div>

      {/* ── Ledger ── */}
      {loading ? (
        <SkeletonList count={5} />
      ) : sortedDates.length === 0 ? (
        <div className="flex flex-col items-center">
          <EmptyState
            title={t('empty.expenses')}
            hint={t('empty.expensesHint')}
          />
          <button
            onClick={async () => {
              try {
                const { seedInitialData } = await import('../lib/seed')
                toast.loading('Seeding sample expenses...', { id: 'seed' })
                await seedInitialData(user.uid, user.displayName)
                toast.success('Sample database seeded successfully!', { id: 'seed' })
              } catch (err) {
                toast.error(err.message, { id: 'seed' })
              }
            }}
            className="btn-ghost text-blue-600 text-xs font-bold py-2 px-4 rounded-xl border border-blue-200 mt-2 hover:bg-blue-50 transition-colors"
          >
            🌱 Seed Sample Data (3 Friends & Expenses)
          </button>
        </div>
      ) : (
        <div className="bg-white">
          {sortedDates.map((dateKey) => {
            const dayExpenses = grouped.get(dateKey)
            const dayTotal    = dayExpenses.reduce((s, e) => s + e.amount, 0)
            const label       = smartDateLabel(new Date(dateKey), lang, {
              today:     t('home.today'),
              yesterday: t('home.yesterday'),
            })

            return (
              <section key={dateKey}>
                {/* Sticky date header */}
                <div className="date-header">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {label}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 amount-display">
                    {formatCurrency(dayTotal, currency)}
                  </span>
                </div>

                {/* Entries */}
                {dayExpenses.map((exp) => (
                  <ExpenseCard key={exp.id} expense={exp} onEdit={handleEdit} />
                ))}
              </section>
            )
          })}
        </div>
      )}

      {/* ── Edit/Add Sheet ── */}
      <BottomSheet
        open={sheetOpen}
        onClose={handleCloseSheet}
        title={editExpense ? t('expense.edit') : t('expense.add')}
        fullHeight
      >
        <ExpenseForm onClose={handleCloseSheet} editExpense={editExpense} />
      </BottomSheet>

      {/* ── Filter sheet ── */}
      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('home.filter')}
      >
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCat('')}
                className={`chip ${!filterCat ? 'active' : ''}`}
              >
                {t('home.allCategories')}
              </button>
              {CATEGORY_KEYS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`chip ${filterCat === cat ? 'active' : ''}`}
                >
                  {t(`expense.categories.${cat}`)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setFilterOpen(false)}
            className="btn-primary mt-2"
          >
            {t('common.done')}
          </button>
        </div>
      </BottomSheet>
    </PageLayout>
  )
}

/** Summary card: owed / owes / net */
function SummaryCard({ label, amount, type, currency }) {
  const colorClass = {
    credit: 'text-green-700',
    debit:  'text-red-600',
  }[type] || 'text-gray-700'

  const bgClass = {
    credit: 'bg-green-50',
    debit:  'bg-red-50',
  }[type] || 'bg-gray-50'

  return (
    <div className={`card p-3 ${bgClass}`}>
      <p className="text-[10px] text-gray-400 font-medium leading-tight mb-1">{label}</p>
      <p className={`text-sm font-bold leading-tight amount-display ${colorClass}`}>
        {formatCurrency(Math.abs(amount), currency)}
      </p>
    </div>
  )
}

// Export openAddSheet so BottomNav can call it
export { Home as default }
