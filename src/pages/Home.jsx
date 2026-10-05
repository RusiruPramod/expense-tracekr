/**
 * src/pages/Home.jsx
 * Daily ledger — date-wise grouped expense journal with summary cards.
 * Highly optimized for performance with memoized components and deferred search filtering.
 */

import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, memo } from 'react'
import { isSameDay } from 'date-fns'
import { useTranslation } from 'react-i18next'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subWeeks,
  addWeeks,
  addDays,
  subDays,
  getYear,
  getMonth,
  getDate,
  isSameMonth,
  isToday as isDateToday,
} from 'date-fns'
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, Calendar, Receipt, Plus } from 'lucide-react'
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
import { TodaySettlement } from '../components/expense/TodaySettlement'
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
  const deferredSearch = useDeferredValue(search)
  const [filterCat,   setFilterCat]     = useState('')
  const [filterOpen,  setFilterOpen]    = useState(false)

  // ── Selected day filter (defaults to Today for date-wise isolation) ──────────
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [viewMode,     setViewMode]     = useState('day') // 'day' | 'all'

  const handleSelectDate = useCallback((day) => {
    setSelectedDate(day)
    setViewMode('day')
  }, [])

  const handlePrevDay = useCallback(() => {
    setSelectedDate((prev) => subDays(prev || new Date(), 1))
    setViewMode('day')
  }, [])

  const handleNextDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev || new Date(), 1))
    setViewMode('day')
  }, [])

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
      const nowDate = new Date()
      const midnight = new Date(nowDate)
      midnight.setHours(24, 0, 0, 0)
      return midnight - nowDate
    }
    let timer
    function scheduleNext() {
      timer = setTimeout(() => {
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

  // ── Filter by selected month (+ optional day) ─────────────────
  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth])
  const monthEnd   = useMemo(() => endOfMonth(currentMonth), [currentMonth])

  const filteredExpenses = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const activeDay = selectedDate || now
    return expenses.filter((e) => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
      // Strict date-wise mode: only show expenses for the active day
      if (viewMode === 'day') {
        if (!isSameDay(d, activeDay)) return false
      } else {
        // All history: filter within selected month
        if (d < monthStart || d > monthEnd) return false
      }
      if (filterCat && e.category !== filterCat) return false
      if (q && !e.title?.toLowerCase().includes(q)) return false
      return true
    })
  }, [expenses, viewMode, selectedDate, now, monthStart, monthEnd, filterCat, deferredSearch])

  // ── Group by date ─────────────────────────────────────────────
  const grouped     = useMemo(() => groupByDate(filteredExpenses), [filteredExpenses])
  const sortedDates = useMemo(() => Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a)), [grouped])

  const handleEdit = useCallback((expense) => {
    setEditExpense(expense)
    setSheetOpen(true)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false)
    setEditExpense(null)
  }, [])

  // ── Picker helpers ────────────────────────────────────────────
  const openPicker = useCallback(() => {
    setPickerYear(getYear(currentMonth))
    setShowPicker(true)
  }, [currentMonth])

  const applyPicker = useCallback((monthIndex) => {
    setCurrentMonth(new Date(pickerYear, monthIndex, 1))
    setShowPicker(false)
  }, [pickerYear])

  const goToToday = useCallback(() => {
    setCurrentMonth(new Date())
    setShowPicker(false)
  }, [])

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

      {/* ── Week Strip Calendar ── */}
      <WeekStrip
        now={now}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        expenses={expenses}
        openPicker={openPicker}
        isViewingNow={isViewingNow}
        showPicker={showPicker}
        pickerRef={pickerRef}
        pickerYear={pickerYear}
        setPickerYear={setPickerYear}
        applyPicker={applyPicker}
        goToToday={goToToday}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* ── Day Navigation Bar (Prev Day / Date Badge / Next Day & View Mode) ── */}
      <div className="px-3 sm:px-4 md:px-0 pt-2 pb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-2xs"
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => { setSelectedDate(new Date()); setViewMode('day') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
              viewMode === 'day' && isSameDay(selectedDate, now)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Calendar size={13} />
            <span>
              {isSameDay(selectedDate, now)
                ? (lang === 'si' ? 'අද (Today)' : 'Today')
                : format(selectedDate, 'MMM dd (EEE)')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-2xs"
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === 'day'
                ? 'bg-white text-blue-700 font-bold shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {lang === 'si' ? 'දින අනුව' : 'Day View'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              viewMode === 'all'
                ? 'bg-white text-blue-700 font-bold shadow-2xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {lang === 'si' ? 'සියලු දින' : 'All History'}
          </button>
        </div>
      </div>

      {/* ── Balance summary cards ── */}
      {loading && expenses.length === 0 ? (
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

      {/* ── Today's Settlement Summary (Calculates running total up to selected date) ── */}
      <TodaySettlement now={selectedDate || now} />

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
      {loading && expenses.length === 0 ? (
        <SkeletonList count={5} />
      ) : sortedDates.length === 0 ? (
        viewMode === 'day' ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-2xs my-2 mx-3 sm:mx-4 md:mx-0">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
              <Receipt size={22} />
            </div>
            <h3 className="text-sm font-bold text-gray-800">
              {isSameDay(selectedDate, now)
                ? (lang === 'si' ? 'අද දින සඳහා වියදම් කිසිවක් නැත' : 'No expenses recorded for today')
                : (lang === 'si' ? `${format(selectedDate, 'yyyy/MM/dd')} දින වියදම් නැත` : `No expenses for ${format(selectedDate, 'yyyy/MM/dd')}`)}
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              {lang === 'si'
                ? 'නව වියදමක් ඇතුළත් කිරීමට පහත බොත්තම ඔබන්න.'
                : 'Tap the button below to add an expense for this date.'}
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Plus size={15} />
              <span>{lang === 'si' ? '+ වියදමක් එක් කරන්න' : '+ Add Expense'}</span>
            </button>
          </div>
        ) : (
          <EmptyState
            title={t('empty.expenses')}
            hint={t('empty.expensesHint')}
          />
        )
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
                  currentUserId={user?.uid}
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
        <ExpenseForm onClose={handleCloseSheet} editExpense={editExpense} defaultDate={selectedDate} />
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

/** Week-strip calendar — memoized */
const WeekStrip = memo(function WeekStrip({
  now, currentMonth, expenses,
  openPicker,
  showPicker, pickerRef, pickerYear, setPickerYear, applyPicker, goToToday,
  selectedDate, onSelectDate,
}) {
  const [weekAnchor, setWeekAnchor] = useState(now)

  // Get Sun→Sat for the anchor week
  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 0 }), [weekAnchor])
  const weekEnd   = useMemo(() => endOfWeek(weekAnchor,   { weekStartsOn: 0 }), [weekAnchor])
  const weekDays  = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  // Dates that have expenses (for dot indicator)
  const expenseDates = useMemo(() => {
    const set = new Set()
    for (const e of expenses) {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
      set.add(format(d, 'yyyy-MM-dd'))
    }
    return set
  }, [expenses])

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="relative bg-white border-b border-gray-100 px-3 sm:px-4 md:px-0 pt-3 pb-2">
      {/* ── Date header: YYYY/MM/DD Day ── */}
      <div className="flex items-center justify-center mb-3">
        <button
          onClick={openPicker}
          className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors tracking-wide"
        >
          {format(now, 'yyyy/MM/dd')} {format(now, 'EEE')}
        </button>
      </div>

      {/* ── Week row ── */}
      <div className="flex items-center justify-between">
        {/* Prev week arrow */}
        <button
          onClick={() => setWeekAnchor((a) => subWeeks(a, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Previous week"
        >
          <ChevronLeft size={16} className="text-gray-400" />
        </button>

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7 gap-0">
          {weekDays.map((day, i) => {
            const isToday    = isDateToday(day)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const hasExpense = expenseDates.has(format(day, 'yyyy-MM-dd'))
            const dateNum    = getDate(day)

            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectDate(day)}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
              >
                {/* Day name */}
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isSelected ? 'text-blue-600' : isToday ? 'text-blue-500' : 'text-gray-400'
                }`}>
                  {DAY_NAMES[i]}
                </span>

                {/* Date number */}
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center transition-all
                  ${isSelected && !isToday
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400 ring-offset-1'
                    : isSelected && isToday
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1 shadow-sm shadow-blue-200'
                    : isToday
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}>
                  <span className={`text-sm tabular-nums leading-none ${
                    isToday || isSelected ? 'font-bold' : 'font-medium'
                  }`}>
                    {dateNum}
                  </span>
                </div>

                {/* Expense dot */}
                <div className={`w-1 h-1 rounded-full transition-all ${
                  hasExpense
                    ? isSelected ? 'bg-blue-600' : isToday ? 'bg-white' : 'bg-blue-400'
                    : 'bg-transparent'
                }`} />
              </button>
            )
          })}
        </div>

        {/* Next week arrow */}
        <button
          onClick={() => setWeekAnchor((a) => addWeeks(a, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Next week"
        >
          <ChevronRight size={16} className="text-gray-400" />
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
  )
})

/** Summary card: owed / owes / net — memoized */
const SummaryCard = memo(function SummaryCard({ label, amount, type, currency }) {
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
})

export { Home as default }
