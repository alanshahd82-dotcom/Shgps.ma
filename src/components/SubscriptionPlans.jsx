import React from 'react'
import { Check, CalendarRange } from 'lucide-react'
import { CUSTOM_PLAN, FREE_TRIAL_PLAN, SUBSCRIPTION_PLANS, customRangeError } from '../utils/subscriptions'

const todayISO = () => new Date().toISOString().slice(0, 10)

// Fixed plans, plus (for administrators) "custom": the exact period from a date to a date.
export default function SubscriptionPlans({
  value, onChange, lang = 'ar', compact = false, includeTrial = false,
  allowCustom = false, range, onRangeChange,
}) {
  const isAr = lang === 'ar'
  const plans = includeTrial ? [FREE_TRIAL_PLAN, ...SUBSCRIPTION_PLANS] : SUBSCRIPTION_PLANS
  const cols = plans.length + (allowCustom ? 1 : 0)
  const customSelected = allowCustom && value === CUSTOM_PLAN.id
  const error = customSelected ? customRangeError(range, isAr) : ''

  const pickCustom = () => {
    onChange?.(CUSTOM_PLAN.id)
    if (!range?.start) onRangeChange?.({ start: todayISO(), end: range?.end || '' })
  }

  return (
    <div className={compact ? '' : 'mt-2'}>
      <div className={`grid grid-cols-1 ${cols >= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-2.5`}>
        {plans.map(plan => {
          const selected = value === plan.id
          return (
            <button
              type="button"
              key={plan.id}
              onClick={() => onChange?.(plan.id)}
              className={`relative text-start rounded-2xl border-2 p-3 transition-all ${
                selected
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-primary-200'
              }`}
            >
              {selected && (
                <span className="absolute top-2 end-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </span>
              )}
              <p className="text-xs font-black text-primary-500">
                {isAr ? plan.label : plan.labelFr}
              </p>
              <p className={`text-lg font-black mt-1 ${plan.trial ? 'text-emerald-700' : 'text-slate-800'}`}>
                {plan.price} <span className="text-[10px] font-bold text-slate-400">MAD</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {plan.trial ? (isAr ? 'للعميل الجديد' : 'Nouveaux clients') : (isAr ? 'دفع نقدي' : 'Paiement comptant')}
              </p>
            </button>
          )
        })}

        {allowCustom && (
          <button
            type="button"
            onClick={pickCustom}
            aria-pressed={customSelected}
            className={`relative text-start rounded-2xl border-2 border-dashed p-3 transition-all ${
              customSelected
                ? 'border-primary-500 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-primary-200'
            }`}
          >
            {customSelected && (
              <span className="absolute top-2 end-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                <Check size={12} className="text-white" />
              </span>
            )}
            <p className="text-xs font-black text-primary-500 flex items-center gap-1.5">
              <CalendarRange size={13} />{isAr ? CUSTOM_PLAN.label : CUSTOM_PLAN.labelFr}
            </p>
            <p className="text-sm font-black mt-1 text-slate-800">{isAr ? 'من ... إلى ...' : 'Du ... au ...'}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'حدّد التاريخين بنفسك' : 'Choisissez les deux dates'}</p>
          </button>
        )}
      </div>

      {customSelected && (
        <div className="mt-3 rounded-2xl border border-primary-100 bg-primary-50/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] font-bold text-slate-500">
              {isAr ? 'من (البداية)' : 'Du (début)'}
              <input
                type="date"
                value={range?.start || ''}
                max={range?.end || undefined}
                onChange={e => onRangeChange?.({ start: e.target.value, end: range?.end || '' })}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </label>
            <label className="block text-[11px] font-bold text-slate-500">
              {isAr ? 'إلى (النهاية)' : 'Au (fin)'}
              <input
                type="date"
                value={range?.end || ''}
                min={range?.start || undefined}
                onChange={e => onRangeChange?.({ start: range?.start || '', end: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </label>
          </div>
          {error && <p className="mt-2 text-[11px] font-semibold text-red-500" role="alert">{error}</p>}
        </div>
      )}
    </div>
  )
}
