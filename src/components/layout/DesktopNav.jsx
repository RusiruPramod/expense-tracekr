/**
 * src/components/layout/DesktopNav.jsx
 * Responsive desktop top navbar for medium & large screens (>= md).
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Users, BarChart2, User, Plus, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useGroup } from '../../context/GroupContext'
import { setLanguage, getCurrentLang } from '../../lib/i18n'

export function DesktopNav({ onAddPress }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { activeGroup } = useGroup()
  const navigate = useNavigate()

  const lang = getCurrentLang()

  return (
    <header className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Active Group */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-sm">
              ₹
            </div>
            <div>
              <h1 className="text-base font-extrabold text-gray-900 leading-none">
                Splitly
              </h1>
              <p className="text-[11px] text-gray-500 font-medium leading-tight mt-0.5">
                Expense Tracker
              </p>
            </div>
          </div>

          {activeGroup && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>{activeGroup.name}</span>
            </div>
          )}
        </div>

        {/* Center Nav Links */}
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Home size={18} />
            <span>{t('nav.home') || 'Ledger'}</span>
          </NavLink>

          <NavLink
            to="/people"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Users size={18} />
            <span>{t('nav.people') || 'People'}</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <BarChart2 size={18} />
            <span>{t('nav.reports') || 'Reports'}</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <User size={18} />
            <span>{t('nav.profile') || 'Profile'}</span>
          </NavLink>
        </nav>

        {/* Right Actions: Language + Add Expense button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-2 py-1 bg-gray-50 text-xs font-medium text-gray-700">
            <Globe size={14} className="text-gray-400" />
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="en">English</option>
              <option value="si">සිංහල</option>
            </select>
          </div>

          <button
            onClick={onAddPress}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Expense</span>
          </button>
        </div>

      </div>
    </header>
  )
}
