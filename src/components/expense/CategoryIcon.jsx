/**
 * src/components/expense/CategoryIcon.jsx
 * Monochrome category icons (lucide).
 */

import {
  Utensils,
  Bus,
  Zap,
  Smile,
  MoreHorizontal,
} from 'lucide-react'

const CATEGORIES = {
  food:      { icon: Utensils,      label: 'Food' },
  transport: { icon: Bus,           label: 'Transport' },
  bills:     { icon: Zap,           label: 'Bills' },
  fun:       { icon: Smile,         label: 'Fun' },
  other:     { icon: MoreHorizontal, label: 'Other' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES)

export function CategoryIcon({ category = 'other', size = 18, className = '' }) {
  const { icon: Icon } = CATEGORIES[category] || CATEGORIES.other
  return <Icon size={size} className={className} />
}

export function CategoryChip({ category, selected, onClick, label }) {
  const Icon = (CATEGORIES[category] || CATEGORIES.other).icon
  return (
    <button
      type="button"
      onClick={() => onClick?.(category)}
      className={`chip ${selected ? 'active' : ''}`}
      aria-pressed={selected}
      aria-label={label || category}
    >
      <Icon size={14} />
      <span>{label || CATEGORIES[category]?.label || category}</span>
    </button>
  )
}
