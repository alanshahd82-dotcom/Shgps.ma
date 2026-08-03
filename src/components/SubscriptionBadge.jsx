import React from 'react'
import { getSubscriptionSnapshot, getSubscriptionPlan } from '../utils/subscriptions'

export default function SubscriptionBadge({ device, lang = 'ar', dark = false }) {
  const isAr = lang === 'ar'
  const subscription = getSubscriptionSnapshot(device)
  const plan = getSubscriptionPlan(subscription.planId)
  const meta = {
    unassigned: {
      label: isAr ? 'الخطة غير محددة' : 'Plan à définir',
      className: dark ? 'bg-slate-400/15 text-slate-300 border-slate-400/30' : 'bg-slate-50 text-slate-600 border-slate-200',
    },
    active: {
      label: isAr ? 'نشط' : 'Actif',
      className: dark ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    expiring_soon: {
      label: isAr ? `ينتهي خلال ${subscription.daysRemaining} يوم` : `Expire dans ${subscription.daysRemaining} j`,
      className: dark ? 'bg-orange-400/15 text-orange-300 border-orange-400/30' : 'bg-orange-50 text-orange-600 border-orange-100',
    },
    expired: {
      label: isAr ? 'منتهي' : 'Expiré',
      className: dark ? 'bg-red-400/15 text-red-300 border-red-400/30' : 'bg-red-50 text-red-600 border-red-100',
    },
  }[subscription.status]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${meta.className}`}>
      {meta.label}
      {plan && <span className="opacity-70">· {isAr ? plan.label : plan.labelFr}</span>}
    </span>
  )
}
