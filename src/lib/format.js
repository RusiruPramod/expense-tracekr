/**
 * src/lib/format.js
 * Currency, date, and number formatters.
 */

import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { enUS } from 'date-fns/locale'

// ── Currency ────────────────────────────────────────────────

/**
 * Formats a float amount to currency string.
 * @param {number} amount
 * @param {string} currency  e.g. 'LKR'
 * @param {string} lang      'en' | 'si'
 * @returns {string}  e.g. "Rs 2,450.00"
 */
export function formatCurrency(amount, currency = 'LKR', lang = 'en') {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  const symbol = currency === 'LKR' ? 'Rs' : currency

  // Always use Latin digits for numbers, regardless of language
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)

  return `${sign}${symbol} ${formatted}`
}

/**
 * Formats amount without sign (absolute value).
 */
export function formatAmount(amount, currency = 'LKR') {
  return formatCurrency(Math.abs(amount), currency)
}

// ── Dates ────────────────────────────────────────────────────

const localeMap = { en: enUS, si: enUS }

/**
 * Returns locale-aware date string.
 * @param {Date|string|number} date
 * @param {string} lang  'en' | 'si'
 * @returns {string}
 */
export function formatDate(date, lang = 'en') {
  const d = date instanceof Date ? date : new Date(date)
  const locale = localeMap[lang] || enUS
  return format(d, 'dd MMM yyyy', { locale })
}

/**
 * Smart relative date label: "Today", "Yesterday", or formatted date.
 * @param {Date|string|number} date
 * @param {string} lang
 * @param {object} t  i18n translation function output (object with en/si keys)
 * @returns {string}
 */
export function smartDateLabel(date, lang = 'en', labels = {}) {
  const d = date instanceof Date ? date : new Date(date)
  if (isToday(d))     return labels.today     || (lang === 'si' ? 'අද'  : 'Today')
  if (isYesterday(d)) return labels.yesterday || (lang === 'si' ? 'ඊයේ' : 'Yesterday')

  const locale = localeMap[lang] || enUS
  return format(d, 'EEE, dd MMM', { locale })
}

/**
 * Formats date for month header: "October 2025"
 */
export function formatMonth(date, lang = 'en') {
  const d = date instanceof Date ? date : new Date(date)
  const locale = localeMap[lang] || enUS
  return format(d, 'MMMM yyyy', { locale })
}

/**
 * Formats a Firestore Timestamp or JS Date to a compact display string.
 */
export function formatTimestamp(ts, lang = 'en') {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return formatDate(d, lang)
}

/**
 * Groups a list of items by date string (YYYY-MM-DD).
 * @param {Array<{date: Date|Timestamp|string}>} items
 * @returns {Map<string, Array>}
 */
export function groupByDate(items) {
  const groups = new Map()

  for (const item of items) {
    const d = item.date?.toDate ? item.date.toDate() : new Date(item.date)
    const key = format(d, 'yyyy-MM-dd')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  return groups
}

// ── Initials ─────────────────────────────────────────────────

/**
 * Returns up to 2 characters for avatar initials from a full name.
 */
export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Misc ──────────────────────────────────────────────────────

/**
 * Truncates a string to maxLen characters with ellipsis.
 */
export function truncate(str = '', maxLen = 30) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}

/**
 * Converts a date to a Firestore-compatible ISO string (YYYY-MM-DD).
 */
export function toDateString(date = new Date()) {
  return format(date instanceof Date ? date : new Date(date), 'yyyy-MM-dd')
}

/**
 * Generates a short random ID for guest members.
 */
export function generateGuestId() {
  return 'guest_' + Math.random().toString(36).slice(2, 9)
}
