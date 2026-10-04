/**
 * src/components/layout/BottomNav.jsx
 * Mobile bottom tab bar with FAB for adding expenses.
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Receipt, Users, Plus, BarChart2, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const tabs = [
  { to: '/',        icon: Home,      key: 'home'    },
  { to: '/summary', icon: Receipt,   key: 'summary' },
  { to: null,       icon: Plus,      key: 'add', isFab: true },
  { to: '/people',  icon: Users,     key: 'people'  },
  { to: '/reports', icon: BarChart2, key: 'reports' },
]

export function BottomNav({ onAddPress }) {
  const { t } = useTranslation()

  return (
    <nav className="bottom-nav md:hidden" aria-label="Main navigation">
      <div className="flex items-end justify-around px-2 h-16">
        {tabs.map((tab) => {
          if (tab.isFab) {
            return (
              <div key="fab" className="flex flex-col items-center" style={{ marginBottom: 6 }}>
                <motion.button
                  whileTap={{ scale: 0.90 }}
                  className="fab"
                  onClick={onAddPress}
                  aria-label={t('nav.add')}
                  id="fab-add-expense"
                >
                  <Plus size={26} strokeWidth={2.5} />
                </motion.button>
              </div>
            )
          }

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 flex-1 py-2 transition-colors min-h-[44px] justify-center ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`
              }
              aria-label={t(`nav.${tab.key}`)}
            >
              {({ isActive }) => (
                <>
                  <tab.icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[10px] font-medium leading-tight">
                    {t(`nav.${tab.key}`)}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
