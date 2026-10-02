import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './lib/i18n'

import { AuthProvider, useAuth } from './context/AuthContext'
import { GroupProvider } from './context/GroupContext'

import { Auth } from './pages/Auth'
import { Home } from './pages/Home'
import { People } from './pages/People'
import { LanguageSelect } from './pages/LanguageSelect'

import { BottomNav } from './components/layout/BottomNav'
import { BottomSheet } from './components/ui/BottomSheet'
import { ExpenseForm } from './components/expense/ExpenseForm'
import { useTranslation } from 'react-i18next'
import { setLanguage } from './lib/i18n'
import { LogOut, Globe, User, ShieldCheck } from 'lucide-react'

import { ReportsPage } from './pages/Reports'

function ProfilePage() {
  const { user, profile, logout } = useAuth()
  const { t, i18n } = useTranslation()

  return (
    <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto min-h-dvh bg-gray-50 pb-24 md:pb-16 pt-safe">
      <div className="p-4 md:pt-6 md:pb-4 bg-white md:bg-transparent border-b border-gray-100 md:border-none flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center shrink-0">
          {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{user?.displayName || 'User'}</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Settings</h3>
          
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Language / භාෂාව</span>
            </div>
            <select
              value={i18n.language?.startsWith('si') ? 'si' : 'en'}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 font-medium"
            >
              <option value="en">English</option>
              <option value="si">සිංහල</option>
            </select>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors"
        >
          <LogOut size={18} />
          {t('common.logout') || 'Sign Out'}
        </button>
      </div>
    </div>
  )
}

import { DesktopNav } from './components/layout/DesktopNav'

function MainLayout() {
  const [showAddForm, setShowAddForm] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="relative min-h-dvh bg-gray-50 flex flex-col w-full overflow-x-hidden">
      {/* Desktop Top Navbar — full width, sticky */}
      <DesktopNav onAddPress={() => setShowAddForm(true)} />

      {/* Page content — grows to fill, scrollable */}
      <main className="flex-1 w-full overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/people" element={<People />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Mobile Bottom navigation — hidden on md+ */}
      <BottomNav onAddPress={() => setShowAddForm(true)} />

      {/* Add expense sheet */}
      <BottomSheet
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={t('expense.addTitle') || 'Add Expense'}
        fullHeight
      >
        <ExpenseForm onClose={() => setShowAddForm(false)} />
      </BottomSheet>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [langChosen, setLangChosen] = useState(() => !!localStorage.getItem('expense_tracker_lang'))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-white">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white font-black text-2xl flex items-center justify-center animate-pulse mb-3">
          ₹
        </div>
        <p className="text-sm font-medium text-gray-400">Loading Splitly...</p>
      </div>
    )
  }

  if (!langChosen) {
    return <LanguageSelect onContinue={() => setLangChosen(true)} />
  }

  if (!user) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <GroupProvider>
        <AppContent />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </GroupProvider>
    </AuthProvider>
  )
}

