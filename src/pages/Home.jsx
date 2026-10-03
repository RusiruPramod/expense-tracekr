/**
 * src/pages/Home.jsx
 * Daily ledger — date-wise grouped expense journal with summary cards.
 * - Seed buttons removed; all data from Firebase Firestore (real-time)
 * - Year/Month picker with auto real-time midnight sync
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  subDays,
  addDays,
  getYear,
  getMonth,
  isSameMonth,
} from 'date-fns'
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, CalendarDays } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { ExpenseCard } from '../components/expense/ExpenseCard'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ExpenseForm } from '../components/expense/ExpenseForm'
import { SkeletonList, SkeletonSummary } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { CATEGORY_KEYS } from '../components/expense/CategoryIcon'
import { DailySummaryCard } from '../components/expense/DailySummaryCard'
import { getPersonBalance } from '../lib/calculations'
import { formatCurrency, smartDateLabel, groupByDate } from '../lib/format'
import { getCurrentLang } from '../lib/i18n'

const MONTHS = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
]

export function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { expenses, settlements, members, activeGroup, loading } = useGroup()

  const lang = getCurrentLang()
  const currency = activeGroup?.currency || 'LKR'

  const [editExpense, setEditExpense]   = useState(null)
  const [sheetOpen,   setSheetOpen]     = useState(false)
  const [search,      setSearch]        = useState('')
  const [filterCat,   setFilterCat]     = useState('')
  const [filterOpen,  setFilterOpen]    = useState(false)

  // ── Real-time current month — auto-advances at midnight ────────
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [showPicker,   setShowPicker]   = useState(false)
  const [pickerYear,   setPickerYear]   = useState(() => getYear(new Date()))
  const pickerRef = useRef(null)

  // ── Live real-time clock (updates every minute) ────────────────
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [])

  // Auto-advance month at real-time midnight
  useEffect(() => {
    function msUntilMidnight() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      return midnight - now
    }
    let timer
    function scheduleNext() {
      timer = setTimeout(() => {
        // Only auto-advance if user is viewing the current real month
        setCurrentMonth((prev) => {
          const today = new Date()
          if (isSameMonth(prev, today)) return today
          return prev
        })
        scheduleNext()
      }, msUntilMidnight())
    }
    scheduleNext()
    return () => clearTimeout(timer)
  }, [])

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  // ── Balance summary ───────────────────────────────────────────
  const balance = useMemo(() => {
    if (!user?.uid || !expenses.length) return { owed: 0, owes: 0, net: 0 }
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

  // ── Filter by selected month ──────────────────────────────────
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
      if (d < monthStart || d > monthEnd) return false
      if (filterCat && e.category !== filterCat) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.title?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [expenses, monthStart, monthEnd, filterCat, search])

  // ── Group by date ─────────────────────────────────────────────
  const grouped     = useMemo(() => groupByDate(filteredExpenses), [filteredExpenses])
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

  const handleEdit = (expense) => {
    setEditExpense(expense)
    setSheetOpen(true)
  }

  const handleCloseSheet = () => {
    setSheetOpen(false)
    setEditExpense(null)
  }

  // ── Picker helpers ────────────────────────────────────────────
  const openPicker = () => {
    setPickerYear(getYear(currentMonth))
    setShowPicker(true)
  }

  const applyPicker = (monthIndex) => {
    setCurrentMonth(new Date(pickerYear, monthIndex, 1))
    setShowPicker(false)
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
    setShowPicker(false)
  }

  const isViewingNow = isSameMonth(currentMonth, new Date())

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

      {/* ── Month / Year Navigator ── */}
      <div className="relative px-3 sm:px-4 md:px-0 pt-3 pb-2 bg-white border-b border-gray-100">


        {/* Month switcher row */}
        <div className="flex items-center justify-between">
          {/* Prev month */}
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} className="text-gray-500" />
          </button>

          {/* Clickable month-year label */}
          <button
            onClick={openPicker}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors group"
            aria-label="Pick year and month"
          >
            <CalendarDays size={15} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-sm font-bold text-gray-800">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            {!isViewingNow && (
              <span className="ml-1 text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                ≠ Now
              </span>
            )}
          </button>

          {/* Next month */}
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={20} className="text-gray-500" />
          </button>
        </div>

        {/* ── Year/Month Picker Dropdown ── */}
        <AnimatePresence>
          {showPicker && (
            <motion.div
              ref={pickerRef}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-4"
              style={{ width: 288 }}
            >
              {/* Year row */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setPickerYear((y) => y - 1)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft size={16} className="text-gray-600" />
                </button>
                <span className="text-base font-black text-gray-900">{pickerYear}</span>
                <button
                  onClick={() => setPickerYear((y) => y + 1)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                  <ChevronRight size={16} className="text-gray-600" />
                </button>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {MONTHS.map((name, idx) => {
                  const isSelected =
                    getYear(currentMonth) === pickerYear &&
                    getMonth(currentMonth) === idx
                  const isRealNow =
                    getYear(new Date()) === pickerYear &&
                    getMonth(new Date()) === idx
                  return (
                    <button
                      key={name}
                      onClick={() => applyPicker(idx)}
                      className={[
                        'py-2 rounded-xl text-xs font-semibold transition-all',
                        isSelected
                          ? 'bg-gray-900 text-white shadow-sm'
                          : isRealNow
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-100',
                      ].join(' ')}
                    >
                      {name.slice(0, 3)}
                    </button>
                  )
                })}
              </div>

              {/* Go to Today */}
              <button
                onClick={goToToday}
                className="w-full py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition-colors"
              >
                Go to Today — {format(new Date(), 'MMM yyyy')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Balance summary cards ── */}
      {loading ? (
        <SkeletonSummary />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-5 px-3 sm:px-4 md:px-0 py-3 md:py-4">
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
      <div className="px-3 sm:px-4 md:px-0 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('home.search')}
            className="input !pl-9 text-sm py-2.5 min-h-[40px]"
          />
        </div>
      </div>

      {/* ── Ledger ── */}
      {loading ? (
        <SkeletonList count={5} />
      ) : sortedDates.length === 0 ? (
        <EmptyState
          title={t('empty.expenses')}
          hint={t('empty.expensesHint')}
        />
      ) : (
        <div className="md:rounded-2xl md:border md:border-gray-100 md:shadow-sm overflow-hidden bg-white">
          {sortedDates.map((dateKey) => {
            const dayExpenses = grouped.get(dateKey)
            const dayTotal    = dayExpenses.reduce((s, e) => s + e.amount, 0)
            const label       = smartDateLabel(new Date(dateKey), lang, {
              today:     t('home.today'),
              yesterday: t('home.yesterday'),
            })

            return (
              <section key={dateKey} className="border-b border-gray-100 last:border-b-0 pb-2">
                {/* Date header */}
                <div className="date-header md:sticky-none">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {label}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 amount-display">
                    {formatCurrency(dayTotal, currency)}
                  </span>
                </div>

                {/* Daily End-of-Day Summary Card */}
                <DailySummaryCard
                  dayExpenses={dayExpenses}
                  members={members}
                  currency={currency}
                />

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
    credit: 'text-emerald-700',
    debit:  'text-rose-600',
  }[type] || 'text-gray-700'

  const bgClass = {
    credit: 'bg-emerald-50/80 border-emerald-100',
    debit:  'bg-rose-50/80 border-rose-100',
  }[type] || 'bg-gray-50 border-gray-200'

  return (
    <div className={`card p-2.5 sm:p-3 md:p-5 border ${bgClass} transition-all`}>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-semibold uppercase tracking-wider mb-0.5 md:mb-1 truncate">{label}</p>
      <p className={`text-xs sm:text-sm md:text-2xl font-bold md:font-black leading-tight amount-display ${colorClass} break-all`}>
        {formatCurrency(Math.abs(amount), currency)}
      </p>
    </div>
  )
}

export { Home as default }
