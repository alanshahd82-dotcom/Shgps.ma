import React from 'react'
import { Check } from 'lucide-react'
import { FREE_TRIAL_PLAN, SUBSCRIPTION_PLANS } from '../utils/subscriptions'

export default function SubscriptionPlans({ value, onChange, lang = 'ar', compact = false, includeTrial = false }) {
  const isAr = lang === 'ar'
  const plans = includeTrial ? [FREE_TRIAL_PLAN, ...SUBSCRIPTION_PLANS] : SUBSCRIPTION_PLANS
  return (
    <div className={`grid grid-cols-1 ${includeTrial ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-2.5 ${compact ? '' : 'mt-2'}`}>
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
    </div>
  )
}
