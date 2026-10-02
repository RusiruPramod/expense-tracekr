/**
 * src/lib/i18n.js
 * react-i18next setup with English (en) and Sinhala (si) locales.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '../locales/en.json'
import si from '../locales/si.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      si: { translation: si },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'si'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'expense_tracker_lang',
    },
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n

/**
 * Set language and persist preference.
 * @param {'en'|'si'} lang
 */
export function setLanguage(lang) {
  i18n.changeLanguage(lang)
  localStorage.setItem('expense_tracker_lang', lang)
  // Update <html lang=""> attribute
  document.documentElement.lang = lang
}

/**
 * Get current language.
 * @returns {'en'|'si'}
 */
export function getCurrentLang() {
  return i18n.language?.startsWith('si') ? 'si' : 'en'
}
