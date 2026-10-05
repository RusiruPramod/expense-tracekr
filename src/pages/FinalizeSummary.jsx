/**
 * src/pages/FinalizeSummary.jsx
 *
 * Dedicated Finalize Settlement Summary page.
 * Real-time cumulative calculations up to current date with 1-click settle,
 * date-wise breakdown, and WhatsApp payment reminders.
 */

import { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'
import { format, isToday as isDateToday, isSameDay } from 'date-fns'
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Share2,
  Wallet,
  Users,
  Search,
  Filter,
  CreditCard,
  Clock,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { PageLayout, PageHeader } from '../components/layout/PageLayout'
import { Avatar } from '../components/ui/Avatar'
import { SettleSheet } from '../components/people/SettleSheet'
import { SkeletonList, SkeletonSummary } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import {
  calculateCumulativeMemberSummary,
  calculateBalancesFlat,
  calculateDailySummary,
} from '../lib/calculations'
import { formatCurrency, smartDateLabel, groupByDate, safeDate } from '../lib/format'
import { getCurrentLang } from '../lib/i18n'

export function FinalizeSummary() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { expenses, settlements, members, activeGroup, loading } = useGroup()

  const lang = getCurrentLang()
  const currency = activeGroup?.currency || 'LKR'

  // Live real-time current date
  const [targetDate, setTargetDate] = useState(() => new Date())
  const [activeTab, setActiveTab] = useState('members') // 'members' | 'datewise' | 'history'
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [filterType, setFilterType] = useState('all') // 'all' | 'pending' | 'settled'
  const [settleTarget, setSettleTarget] = useState(null) // { person, amount, direction }

  // Auto-refresh clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      // Keep real-time date synced
      if (isDateToday(targetDate)) {
        setTargetDate(new Date())
      }
    }, 60_000)
    return () => clearInterval(timer)
  }, [targetDate])

  // Cumulative calculation up to targetDate
  const cumulativeData = useMemo(() => {
    if (!user?.uid) {
      return {
        totalGroupSpent: 0,
        totalToCollectFromMembers: 0,
        totalUserOwesMembers: 0,
        memberSummaries: [],
        simplifiedSettlements: [],
      }
    }
    return calculateCumulativeMemberSummary(
      expenses,
      settlements,
      members,
      user.uid,
      targetDate
    )
  }, [expenses, settlements, members, user?.uid, targetDate])

  // Filtered members list
  const filteredMemberSummaries = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase()
    return cumulativeData.memberSummaries
      .filter((m) => !m.isUser)
      .filter((m) => {
        if (q && !m.name.toLowerCase().includes(q)) return false
        if (filterType === 'pending') {
          return m.status === 'owes_user' || m.status === 'user_owes'
        }
        if (filterType === 'settled') {
          return m.status === 'settled'
        }
        return true
      })
      .sort((a, b) => {
        // Pending dues first, highest amount first
        if (a.status === 'owes_user' && b.status !== 'owes_user') return -1
        if (b.status === 'owes_user' && a.status !== 'owes_user') return 1
        return b.amountDueToUser - a.amountDueToUser
      })
  }, [cumulativeData.memberSummaries, deferredSearchQuery, filterType])

  // Date-wise grouped ledger calculation
  const dateWiseLedger = useMemo(() => {
    const grouped = groupByDate(expenses)
    const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

    return sortedDates.map((dateStr) => {
      const dayExpenses = grouped.get(dateStr)
      const daySummary = calculateDailySummary(dayExpenses, members)
      return {
        dateStr,
        dateObj: safeDate(dateStr),
        dayExpenses,
        daySummary,
      }
    })
  }, [expenses, members])

  // WhatsApp share generator
  const handleWhatsAppShare = (member) => {
    const isSin = lang === 'si'
    const dateFormatted = format(targetDate, 'yyyy-MM-dd')
    let message = ''

    if (member) {
      const amountStr = formatCurrency(member.amountDueToUser, currency)
      if (isSin) {
        message = `ආයුබෝවන් ${member.name},\nSplitly හරහා අද දින (${dateFormatted}) දක්වා ඔබේ ගෙවීමට ඇති මුළු මුදල: *${amountStr}* කි.\nකරුණාකර හැකි ඉක්මනින් පියවන්න. ස්තූතියි!`
      } else {
        message = `Hi ${member.name},\nAccording to Splitly expense summary, your total outstanding balance as of ${dateFormatted} is *${amountStr}*.\nPlease settle when convenient. Thank you!`
      }
    } else {
      // Entire group summary
      const pendingList = cumulativeData.memberSummaries
        .filter((m) => !m.isUser && m.status === 'owes_user')
        .map((m) => `• ${m.name}: *${formatCurrency(m.amountDueToUser, currency)}*`)
        .join('\n')

      if (isSin) {
        message = `📊 *Splitly - අද දින අවසන් සාරාංශය (${dateFormatted})*\n\nමුළු වියදම: *${formatCurrency(cumulativeData.totalGroupSpent, currency)}*\nලැබිය යුතු මුළු මුදල: *${formatCurrency(cumulativeData.totalToCollectFromMembers, currency)}*\n\n*සාමාජිකයින්ගේ ගෙවිය යුතු ශේෂයන්:*\n${pendingList || 'සියලු ශේෂයන් සම්පූර්ණ කර ඇත ✓'}`
      } else {
        message = `📊 *Splitly - Settlement Summary (${dateFormatted})*\n\nTotal Spent: *${formatCurrency(cumulativeData.totalGroupSpent, currency)}*\nTotal to Collect: *${formatCurrency(cumulativeData.totalToCollectFromMembers, currency)}*\n\n*Member Balances Due:*\n${pendingList || 'All balances are fully settled ✓'}`
      }
    }

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const isTodayActive = isDateToday(targetDate)

  return (
    <PageLayout>
      <PageHeader
        title={lang === 'si' ? 'අවසන් සාරාංශය සහ ගෙවීම්' : 'Finalize Summary & Dues'}
        subtitle={format(targetDate, 'EEEE, dd MMMM yyyy')}
        right={
          <button
            onClick={() => handleWhatsAppShare(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all shadow-2xs"
            title="Share group summary on WhatsApp"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">{lang === 'si' ? 'සාරාංශය යවන්න' : 'Share Summary'}</span>
          </button>
        }
      />

      {/* ── Top Real-time Date & Status Banner ── */}
      <div className="px-4 md:px-0 pt-3 pb-1">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Calendar size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    {lang === 'si' ? 'සජීවී ගනුදෙනු ශේෂය' : 'Real-Time Cumulative Balance'}
                  </span>
                  {isTodayActive && (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                      ● Live Today
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                  {format(targetDate, 'yyyy MMMM dd · EEEE')}
                </h2>
              </div>
            </div>

            {!isTodayActive && (
              <button
                onClick={() => setTargetDate(new Date())}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
              >
                <RefreshCw size={13} />
                <span>Jump to Today</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
            {lang === 'si'
              ? 'කලින් දිනවල නොගෙවූ සියලු මුදල් අද දිනට එකතු වී එක් එක් සාමාජිකයා ඔබට ගෙවිය යුතු මුළු මුදල පහතින් ස්වයංක්‍රීයව ගණනය වේ.'
              : 'All unsettled dues from previous days automatically roll forward into the live current balance below.'}
          </p>
        </div>
      </div>

      {/* ── Key Financial Metric Cards ── */}
      {loading && expenses.length === 0 ? (
        <SkeletonSummary />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 md:px-0 py-3">
          {/* Total to Collect */}
          <div className="card p-4 bg-emerald-50/80 border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                {lang === 'si' ? 'ඔබට ලැබිය යුතු මුදල' : 'You are Owed (To Collect)'}
              </span>
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-emerald-700 amount-display mt-1">
              {formatCurrency(cumulativeData.totalToCollectFromMembers, currency)}
            </p>
            <p className="text-[10px] text-emerald-600/90 mt-1 font-medium">
              From members with pending balance
            </p>
          </div>

          {/* Total You Owe */}
          <div className="card p-4 bg-rose-50/80 border border-rose-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                {lang === 'si' ? 'ඔබ ගෙවිය යුතු මුදල' : 'You Owe (To Pay)'}
              </span>
              <TrendingDown size={16} className="text-rose-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-rose-700 amount-display mt-1">
              {formatCurrency(cumulativeData.totalUserOwesMembers, currency)}
            </p>
            <p className="text-[10px] text-rose-600/90 mt-1 font-medium">
              To members you need to settle with
            </p>
          </div>

          {/* Total Group Spend */}
          <div className="card p-4 bg-blue-50/80 border border-blue-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                {lang === 'si' ? 'මුළු වියදම' : 'Total Group Spend'}
              </span>
              <Wallet size={16} className="text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-blue-800 amount-display mt-1">
              {formatCurrency(cumulativeData.totalGroupSpent, currency)}
            </p>
            <p className="text-[10px] text-blue-600/90 mt-1 font-medium">
              Across {cumulativeData.totalExpensesCount} recorded expense item(s)
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs: Member Dues vs Date-Wise Ledger ── */}
      <div className="px-4 md:px-0 pt-2 pb-3">
        <div className="flex items-center p-1 bg-gray-100 rounded-2xl border border-gray-200">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'members'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users size={15} />
            <span>{lang === 'si' ? 'සාමාජික ශේෂයන් (Dues)' : 'Member Dues & Settle'}</span>
          </button>

          <button
            onClick={() => setActiveTab('datewise')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'datewise'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Receipt size={15} />
            <span>{lang === 'si' ? 'දින අනුව විස්තරය' : 'Date-Wise Ledger'}</span>
          </button>
        </div>
      </div>

      {/* ── Tab 1: Member Running Dues ── */}
      {activeTab === 'members' && (
        <div className="px-4 md:px-0 space-y-4 pb-24">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'si' ? 'සාමාජික නම සොයන්න...' : 'Search member by name...'}
                className="input !pl-9 text-xs py-2 min-h-[38px]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterType('all')}
                className={`chip text-xs py-1.5 px-3 ${filterType === 'all' ? 'active' : ''}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('pending')}
                className={`chip text-xs py-1.5 px-3 ${filterType === 'pending' ? 'active' : ''}`}
              >
                {lang === 'si' ? 'ගෙවීමට ඇති අය' : 'Pending Dues'}
              </button>
              <button
                onClick={() => setFilterType('settled')}
                className={`chip text-xs py-1.5 px-3 ${filterType === 'settled' ? 'active' : ''}`}
              >
                {lang === 'si' ? 'සම්පූර්ණ වූ අය' : 'Settled'}
              </button>
            </div>
          </div>

          {/* Members List Cards */}
          {loading && expenses.length === 0 ? (
            <SkeletonList count={4} />
          ) : filteredMemberSummaries.length === 0 ? (
            <EmptyState
              icon={Users}
              title={lang === 'si' ? 'සාමාජිකයින් නොමැත' : 'No members match filter'}
              hint={lang === 'si' ? 'වෙනත් පෙරහනක් තෝරන්න.' : 'Try changing your search or filter.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredMemberSummaries.map((m) => {
                const owesYou = m.status === 'owes_user'
                const youOwe = m.status === 'user_owes'
                const isSettled = m.status === 'settled'

                return (
                  <div
                    key={m.memberId}
                    className={`card p-4 border transition-all ${
                      owesYou
                        ? 'bg-white border-amber-200/90 shadow-2xs hover:border-amber-300'
                        : youOwe
                        ? 'bg-white border-rose-200/90 shadow-2xs hover:border-rose-300'
                        : 'bg-slate-50/70 border-slate-200/70'
                    }`}
                  >
                    {/* Header: Avatar, Name, Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 truncate">{m.name}</h3>
                            {m.isGuest && (
                              <span className="text-[9px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                Friend
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Active across {m.activeDaysCount} day(s)
                          </p>
                        </div>
                      </div>

                      {/* Status pill */}
                      {isSettled ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 size={12} />
                          <span>Settled ✓</span>
                        </span>
                      ) : owesYou ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          <span>Owes You</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                          <span>You Owe</span>
                        </span>
                      )}
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="mt-3.5 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50/90 p-2 rounded-xl">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                          Total Expense Share
                        </span>
                        <span className="font-bold text-gray-800 amount-display">
                          {formatCurrency(m.totalShare, currency)}
                        </span>
                      </div>
                      <div className="bg-gray-50/90 p-2 rounded-xl">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold block">
                          Total Paid
                        </span>
                        <span className="font-bold text-gray-800 amount-display">
                          {formatCurrency(m.totalPaid, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Prominent Current Net Balance */}
                    <div className={`mt-3 p-3 rounded-xl flex items-center justify-between ${
                      owesYou
                        ? 'bg-amber-50/80 border border-amber-100 text-amber-900'
                        : youOwe
                        ? 'bg-rose-50/80 border border-rose-100 text-rose-900'
                        : 'bg-emerald-50/60 border border-emerald-100 text-emerald-800'
                    }`}>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {owesYou
                            ? (lang === 'si' ? 'අද දින ගෙවිය යුතු ශේෂය' : 'Cumulative Due to Owner')
                            : youOwe
                            ? (lang === 'si' ? 'ඔබ ගෙවිය යුතු ශේෂය' : 'You Need to Settle')
                            : (lang === 'si' ? 'ශේෂය පියවා ඇත' : 'Net Running Balance')}
                        </p>
                        <p className="text-base sm:text-lg font-black amount-display">
                          {isSettled
                            ? 'Rs. 0.00'
                            : owesYou
                            ? formatCurrency(m.amountDueToUser, currency)
                            : formatCurrency(m.amountOwedByUser, currency)}
                        </p>
                      </div>

                      {/* Quick 1-Click Settle Button */}
                      {!isSettled && (
                        <button
                          onClick={() =>
                            setSettleTarget({
                              person: { id: m.memberId, name: m.name },
                              amount: owesYou ? m.amountDueToUser : m.amountOwedByUser,
                              direction: owesYou ? 'they_pay' : 'i_pay',
                            })
                          }
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                        >
                          <CreditCard size={14} />
                          <span>{lang === 'si' ? 'ගෙවීම සටහන් කරන්න' : 'Settle Up'}</span>
                        </button>
                      )}
                    </div>

                    {/* WhatsApp Action for Member */}
                    {owesYou && (
                      <div className="mt-2.5 flex justify-end">
                        <button
                          onClick={() => handleWhatsAppShare(m)}
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 py-1 px-2 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <Share2 size={13} />
                          <span>{lang === 'si' ? 'WhatsApp මතක් කිරීමක් යවන්න' : 'Send WhatsApp Reminder'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Date-Wise Daily Ledger ── */}
      {activeTab === 'datewise' && (
        <div className="px-4 md:px-0 space-y-4 pb-24">
          {dateWiseLedger.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses recorded"
              hint="Add an expense to start tracking date-wise totals."
            />
          ) : (
            dateWiseLedger.map(({ dateStr, dateObj, dayExpenses, daySummary }) => {
              const label = smartDateLabel(dateObj, lang, {
                today: t('home.today') || 'Today',
                yesterday: t('home.yesterday') || 'Yesterday',
              })

              return (
                <div key={dateStr} className="card p-4 space-y-3 bg-white border border-gray-200/90 shadow-2xs">
                  {/* Date Header + Day Total */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {format(dateObj, 'dd')}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                          {label} · {format(dateObj, 'MMMM yyyy')}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          {dayExpenses.length} expense entry(s)
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">
                        Day Total Spent
                      </span>
                      <span className="text-sm font-black text-gray-900 amount-display">
                        {formatCurrency(daySummary.totalAmount, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Day Member Breakdown Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-100 text-[10px] uppercase tracking-wider">
                          <th className="text-left pb-1.5 font-bold">Person</th>
                          <th className="text-right pb-1.5 font-bold">Paid</th>
                          <th className="text-right pb-1.5 font-bold">Share</th>
                          <th className="text-right pb-1.5 font-bold">Day Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {daySummary.memberSummaries.map((m) => {
                          const isReceive = m.status === 'receive'
                          const isPay = m.status === 'pay'
                          const isUser = m.memberId === user?.uid

                          return (
                            <tr key={m.memberId} className="hover:bg-gray-50/50">
                              <td className="py-2 pr-2">
                                <span className="font-semibold text-gray-800">
                                  {m.name} {isUser ? '(You)' : ''}
                                </span>
                              </td>
                              <td className="text-right py-2 amount-display text-gray-600">
                                {formatCurrency(m.paid, currency)}
                              </td>
                              <td className="text-right py-2 amount-display text-gray-600">
                                {formatCurrency(m.owes, currency)}
                              </td>
                              <td className="text-right py-2 font-bold amount-display">
                                {m.status === 'settled' ? (
                                  <span className="text-gray-400 text-[11px]">0.00</span>
                                ) : isReceive ? (
                                  <span className="text-emerald-600 text-[11px]">
                                    + {formatCurrency(m.net, currency)}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 text-[11px]">
                                    - {formatCurrency(Math.abs(m.net), currency)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* List of items for this day */}
                  <div className="pt-2 border-t border-dashed border-gray-100 space-y-1.5">
                    {dayExpenses.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-gray-50/70">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="font-medium text-gray-800 truncate">{exp.title}</span>
                          <span className="text-[10px] text-gray-400">
                            (Paid by {members.find((m) => m.id === exp.paidBy)?.name || 'You'})
                          </span>
                        </div>
                        <span className="font-bold text-gray-900 amount-display shrink-0">
                          {formatCurrency(exp.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
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

export default FinalizeSummary
