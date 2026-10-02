/**
 * src/pages/LanguageSelect.jsx
 * Shown only on first launch (before auth) to let user choose language.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage } from '../lib/i18n'
import { motion } from 'framer-motion'

export function LanguageSelect({ onContinue }) {
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState(i18n.language?.startsWith('si') ? 'si' : 'en')

  const handleContinue = () => {
    setLanguage(selected)
    onContinue()
  }

  return (
    <div className="page-wrapper flex flex-col items-center justify-center min-h-dvh p-8 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xs"
      >
        {/* Logo mark */}
        <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-8">
          <span className="text-white text-2xl font-black">₹</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
          {t('language.select')}
        </h1>
        <p className="text-sm text-gray-400 text-center mb-8">
          Choose your preferred language / භාෂාව තෝරන්න
        </p>

        {/* Language options */}
        <div className="space-y-3 mb-8">
          {['en', 'si'].map((lang) => (
            <button
              key={lang}
              onClick={() => setSelected(lang)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                selected === lang
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <span className="text-2xl">{lang === 'en' ? '🇬🇧' : '🇱🇰'}</span>
              <div className="text-left">
                <p className="font-semibold">
                  {lang === 'en' ? 'English' : 'සිංහල'}
                </p>
                <p className={`text-xs ${selected === lang ? 'text-gray-300' : 'text-gray-400'}`}>
                  {lang === 'en' ? 'English interface' : 'සිංහල අතුරුමුහුණත'}
                </p>
              </div>
              {selected === lang && (
                <div className="ml-auto w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        <button onClick={handleContinue} className="btn-primary">
          {selected === 'si' ? 'ඉදිරියට' : 'Continue'}
        </button>
      </motion.div>
    </div>
  )
}
