/**
 * src/components/ui/BottomSheet.jsx
 * Animated bottom sheet using framer-motion.
 * Replaces modals for mobile-first UX.
 */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
}

const sheetVariants = {
  hidden:  { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', damping: 30, stiffness: 350 } },
  exit:    { y: '100%', transition: { duration: 0.22, ease: 'easeIn' } },
}

/**
 * BottomSheet
 * @param {boolean}       open
 * @param {() => void}    onClose
 * @param {string}        title
 * @param {ReactNode}     children
 * @param {string}        className    extra classes on the sheet panel
 * @param {boolean}       showHandle   show drag handle at top
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className = '',
  showHandle = true,
  fullHeight = false,
}) {
  const sheetRef = useRef(null)

  // Trap focus when open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => sheetRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            className="sheet-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={`
              fixed bottom-0 left-1/2 -translate-x-1/2
              w-full max-w-[430px]
              bg-white rounded-t-[24px]
              z-50 outline-none
              pb-safe
              ${fullHeight ? 'max-h-[92dvh]' : 'max-h-[88dvh]'}
              flex flex-col
              ${className}
            `}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Handle */}
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
            )}

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
