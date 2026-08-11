import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { getSubscriptionSnapshot } from '../utils/subscriptions'

export default function SubscriptionBanner({ device, lang = 'ar', onRenew, dark = false }) {
  const isAr = lang === 'ar'
  const subscription = getSubscriptionSnapshot(device)
  if (subscription.status === 'active') return null
  const unassigned = subscription.status === 'unassigned'
  const expired = subscription.status === 'expired'

  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 border ${
      dark
      ? expired ? 'bg-red-400/10 border-red-400/25 text-white' : unassigned ? 'bg-slate-400/10 border-slate-400/25 text-white' : 'bg-orange-400/10 border-orange-400/25 text-white'
        : expired ? 'bg-red-50 border-red-100 text-red-800' : unassigned ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-orange-50 border-orange-100 text-orange-800'
    }`}>
      <AlertTriangle size={18} className={`flex-shrink-0 mt-0.5 ${expired ? 'text-red-400' : unassigned ? 'text-slate-400' : 'text-orange-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black">
          {unassigned
            ? (isAr ? 'لم تُحدد خطة اشتراك لهذا الجهاز' : 'Aucun forfait n’est défini pour cet appareil')
            : expired
            ? (isAr ? 'انتهى اشتراك هذا الجهاز' : 'L’abonnement de cet appareil est expiré')
            : (isAr ? `ينتهي الاشتراك خلال ${subscription.daysRemaining} يوم` : `L’abonnement expire dans ${subscription.daysRemaining} jours`)}
        </p>
        <p className={`text-xs mt-1 ${dark ? 'text-white/55' : 'text-slate-500'}`}>
          {unassigned
            ? (isAr ? 'اطلب من المسؤول تعيين الباقة وتاريخ الانتهاء حتى تظهر تفاصيل الاشتراك.' : 'Demandez à l’administrateur de définir le forfait et sa date d’expiration.')
            : expired
            ? (isAr ? 'تم إيقاف التتبع المباشر فقط. أوامر المحرك ما زالت متاحة.' : 'Le suivi live est désactivé. Les commandes moteur restent disponibles.')
            : (isAr ? 'جدد الآن حتى لا ينقطع التتبع المباشر.' : 'Renouvelez maintenant pour éviter l’interruption du suivi live.')}
        </p>
      </div>
      {onRenew && (
        <button onClick={onRenew} className={`flex items-center gap-1.5 flex-shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
          dark ? 'bg-white text-primary-600' : 'bg-primary-500 text-white'
        }`}>
          <RefreshCw size={13} />
          {isAr ? 'تجديد' : 'Renouveler'}
        </button>
      )}
    </div>
  )
}
