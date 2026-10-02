/**
 * src/components/ui/Avatar.jsx
 * Neutral grey avatar with initials. No per-user colors per design system.
 */

import { getInitials } from '../../lib/format'

export function Avatar({ name = '', size = 'md', className = '', photoURL = null }) {
  const sizeClass = {
    xs:  'avatar-xs',
    sm:  'avatar-sm',
    md:  'avatar',
    lg:  'avatar-lg',
  }[size] || 'avatar'

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ${className}`}
        aria-label={name}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} ${className}`}
      aria-label={name}
      title={name}
    >
      {getInitials(name)}
    </span>
  )
}

/** Stacked avatar group (overlapping) */
export function AvatarStack({ members = [], max = 3, size = 'xs' }) {
  const shown    = members.slice(0, max)
  const overflow = members.length - max

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <Avatar
          key={m.id}
          name={m.name}
          size={size}
          className={i > 0 ? '-ml-2' : ''}
        />
      ))}
      {overflow > 0 && (
        <span className="avatar-xs -ml-2 bg-gray-200 text-gray-600 text-[9px]">
          +{overflow}
        </span>
      )}
    </div>
  )
}
