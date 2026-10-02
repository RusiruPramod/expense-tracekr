/**
 * src/pages/Auth.jsx
 * Login + Register + Password Reset — single unified auth page.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

import { useAuth } from '../context/AuthContext'

const FIREBASE_ERROR_MAP = {
  'auth/invalid-email':       'auth.errors.invalidEmail',
  'auth/weak-password':       'auth.errors.weakPassword',
  'auth/email-already-in-use':'auth.errors.emailInUse',
  'auth/user-not-found':      'auth.errors.userNotFound',
  'auth/wrong-password':      'auth.errors.wrongPassword',
  'auth/network-request-failed': 'auth.errors.networkError',
}

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
        toast.success(t('auth.resetSent'))
        setMode('login')
        return
      }
    } catch (err) {
      toast.error(getErrorMsg(err.code))
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
    <div className="page-wrapper flex flex-col min-h-dvh bg-white">
      {/* Top illustration */}
      <div className="bg-gray-50 pt-safe">
        <div className="flex items-center justify-center py-12">
          <div className="w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center shadow-xl">
            <span className="text-white text-3xl font-black">₹</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
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
               'Enter your email to receive a reset link'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name (signup only) */}
              {mode === 'signup' && (
                <div className="relative">
                  <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('auth.name')}
                    className="input pl-11"
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              {/* Email */}
              <div className="relative">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  className="input pl-11"
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password (not for reset) */}
              {mode !== 'reset' && (
                <div className="relative">
                  <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.password')}
                    className="input pl-11 pr-12"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-xs text-blue-600 font-medium"
                >
                  {t('auth.forgotPassword')}
                </button>
              )}

              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? t('common.loading') :
                 mode === 'login'  ? t('auth.signIn')       :
                 mode === 'signup' ? t('auth.signUp')       : t('auth.resetPassword')}
              </button>
            </form>

            {/* Google sign-in */}
            {mode !== 'reset' && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{t('common.or')}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button
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
            <p className="text-center text-sm text-gray-500 mt-6">
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
  )
}
