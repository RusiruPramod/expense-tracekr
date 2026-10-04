/**
 * src/pages/Auth.jsx
 * Login + Register + Password Reset — single unified auth page.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock, User, Sparkles, KeyRound } from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const FIREBASE_ERROR_MAP = {
  'auth/invalid-email':         'auth.errors.invalidEmail',
  'auth/invalid-credential':    'auth.errors.invalidCredential',
  'auth/user-not-found':        'auth.errors.invalidCredential',
  'auth/wrong-password':        'auth.errors.invalidCredential',
  'auth/email-already-in-use':  'auth.errors.emailInUse',
  'auth/weak-password':         'auth.errors.weakPassword',
  'auth/network-request-failed':'auth.errors.networkError',
}

export const PRESET_USERS = [
  { name: 'Sahan', email: 'sahan@gmail.com', password: 'sahan123456', role: 'Member' },
  { name: 'Kalum', email: 'kalum@gmail.com', password: 'kalum123456', role: 'Member' },
  { name: 'Owner', email: 'owner@gmail.com', password: 'owner123456', role: 'Admin/Owner' },
]

export function Auth() {
  const { t } = useTranslation()
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  const getErrorMsg = (code) =>
    t(FIREBASE_ERROR_MAP[code] || 'auth.errors.generic')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        if (!name.trim()) { toast.error(t('auth.errors.generic')); return }
        await signUp(email, password, name.trim())
      } else {
        await resetPassword(email)
        toast.success(t('auth.resetSent') || 'Password reset email sent! Check your inbox.')
        setMode('login')
        return
      }
    } catch (err) {
      toast.error(getErrorMsg(err.code))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (preset) => {
    setLoading(true)
    setEmail(preset.email)
    setPassword(preset.password)

    try {
      // Try sign in
      await signIn(preset.email, preset.password)
      toast.success(`Welcome, ${preset.name}!`)
    } catch (err) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-email'
      ) {
        // Auto register if account does not exist yet
        try {
          await signUp(preset.email, preset.password, preset.name)
          toast.success(`Account created & logged in as ${preset.name}!`)
        } catch (signUpErr) {
          toast.error(getErrorMsg(signUpErr.code))
        }
      } else {
        toast.error(getErrorMsg(err.code))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      toast.error(getErrorMsg(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 p-4 py-8 md:py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200/80 shadow-xl overflow-hidden">
        {/* Top illustration */}
        <div className="bg-gray-50 pt-safe">
          <div className="flex items-center justify-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl font-black">₹</span>
            </div>
          </div>
        </div>

        <div className="p-6">
        {/* Header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {mode === 'login'  ? t('auth.welcome') :
               mode === 'signup' ? t('auth.signUp')  : t('auth.resetPassword')}
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              {mode === 'login'  ? t('app.tagline') :
               mode === 'signup' ? t('app.tagline')  :
               'Enter your email to receive a password reset link'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name (signup only) */}
              {mode === 'signup' && (
                <div className="relative">
                  <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('auth.name')}
                    className="input !pl-11"
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div className="relative">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  className="input !pl-11"
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password (not for reset) */}
              {mode !== 'reset' && (
                <div className="relative">
                  <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.password')}
                    className="input !pl-11 !pr-12"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    {t('auth.forgotPassword') || 'Forgot password?'}
                  </button>
                  <span className="text-[11px] text-gray-400">Reset via email</span>
                </div>
              )}

              {mode === 'reset' && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                  Enter your email above and tap below to receive a secure Firebase password reset link.
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? t('common.loading') :
                 mode === 'login'  ? t('auth.signIn')       :
                 mode === 'signup' ? t('auth.signUp')       : t('auth.resetPassword')}
              </button>
            </form>

            {/* ── Quick 1-Click Auto Login Buttons ── */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" />
                  Quick 1-Click Login / Demo
                </span>
                <span className="text-[10px] text-blue-600 font-medium">Auto-Fill & Sign In</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {PRESET_USERS.map((preset) => (
                  <button
                    key={preset.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickLogin(preset)}
                    className="p-2 rounded-xl border border-blue-100 bg-blue-50/60 hover:bg-blue-100/80 text-left transition-all active:scale-95 group shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 group-hover:text-blue-700">
                        {preset.name}
                      </span>
                      <span className="text-[9px] font-bold text-blue-600 bg-white px-1 py-0.5 rounded shadow-2xs">
                        ⚡ Auto
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-500 block truncate mt-0.5">
                      {preset.password}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Google sign-in */}
            {mode !== 'reset' && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{t('common.or')}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="btn-ghost w-full"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  {t('auth.googleSignIn')}
                </button>
              </>
            )}

            {/* Mode switcher */}
            <p className="text-center text-sm text-gray-500 mt-5">
              {mode === 'login' ? (
                <>
                  {t('auth.noAccount')}{' '}
                  <button onClick={() => setMode('signup')} className="text-blue-600 font-semibold">
                    {t('auth.signUp')}
                  </button>
                </>
              ) : (
                <>
                  {t('auth.haveAccount')}{' '}
                  <button onClick={() => setMode('login')} className="text-blue-600 font-semibold">
                    {t('auth.signIn')}
                  </button>
                </>
              )}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  </div>
  )
}

