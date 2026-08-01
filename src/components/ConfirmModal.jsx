import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export default function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger = false }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="w-full md:max-w-sm"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl p-6">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle className={`w-7 h-7 ${danger ? 'text-red-500' : 'text-amber-500'}`} />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-center text-primary-500 mb-2">{title}</h3>

              {/* Message */}
              <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">{message}</p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-slate-600 font-semibold hover:bg-gray-50 transition-colors"
                >
                  {cancelLabel || 'إلغاء'}
                </button>
                <button
                  onClick={onConfirm}
                  className={`flex-1 py-3 rounded-2xl font-semibold transition-all active:scale-95 ${
                    danger
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {confirmLabel || 'تأكيد'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
