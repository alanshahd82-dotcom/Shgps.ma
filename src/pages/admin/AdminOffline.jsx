import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MapPin, Phone, Search, WifiOff } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { useApp } from '../../context/AppContext'
import { VehicleIcon } from '../../components/ui'
import { agoLabel, vehiclePoint } from '../../utils/location'
import { isNotConnected, offlineReason, offlineSortValue } from '../../utils/offline'
import { APP_TZ } from '../../utils/datetime.js'

const REASONS = {
  subscription: { color: 'bg-purple-50 text-purple-700 ring-purple-200', ar: 'انتهى الاشتراك', fr: 'Abonnement expiré' },
  power: { color: 'bg-red-50 text-red-700 ring-red-200', ar: 'فصل التغذية', fr: 'Alimentation coupée' },
  never: { color: 'bg-amber-50 text-amber-700 ring-amber-200', ar: 'لم يتصل قط', fr: 'Jamais connecté' },
  long: { color: 'bg-slate-100 text-slate-700 ring-slate-200', ar: 'انقطاع طويل', fr: 'Coupure longue' },
  recent: { color: 'bg-blue-50 text-blue-700 ring-blue-200', ar: 'انقطاع حديث', fr: 'Coupure récente' },
}

function reasonText(reason, isAr) {
  switch (reason.code) {
    case 'subscription':
      return isAr ? 'اشتراك هذا الجهاز منتهي، لذلك أوقف النظام التتبع المباشر. جدّد الاشتراك لإعادته.' : "L'abonnement de cet appareil est expiré : le suivi en direct est arrêté. Renouvelez-le pour le rétablir."
    case 'power':
      return isAr ? 'تم رصد فصل تغذية المركبة عن الجهاز. تحقق من أسلاك الطاقة والبطارية.' : "Une coupure d'alimentation du véhicule a été détectée. Vérifiez les câbles d'alimentation et la batterie."
    case 'never':
      return isAr ? 'لم يتصل هذا الجهاز بالخادم أبداً. تحقق من شريحة SIM وإعدادات APN والخادم (المنفذ 5023).' : "Cet appareil ne s'est jamais connecté au serveur. Vérifiez la carte SIM, l'APN et le serveur (port 5023)."
    case 'long':
      return isAr ? `لا اتصال منذ ${reason.days} يوماً. غالباً الجهاز مفصول الطاقة أو الشريحة بلا رصيد/بيانات. السبب غير مؤكد.` : `Aucune connexion depuis ${reason.days} jours. Probablement appareil débranché ou SIM sans données. Cause non confirmée.`
    default:
      return isAr ? 'انقطع الاتصال منذ وقت قصير، وقد يكون بسبب ضعف تغطية الشبكة. السبب غير مؤكد.' : 'Connexion perdue récemment, souvent à cause d’une couverture réseau faible. Cause non confirmée.'
  }
}

export default function AdminOffline() {
  const { devices, lang } = useApp()
  const navigate = useNavigate()
  const isAr = lang !== 'fr'
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const rows = useMemo(() => (devices || [])
    .filter(isNotConnected)
    .map(device => ({ device, reason: offlineReason(device), point: vehiclePoint(device) }))
    .sort((a, b) => offlineSortValue(a.device) - offlineSortValue(b.device)),
  [devices])

  const counts = useMemo(() => rows.reduce((acc, row) => ({ ...acc, [row.reason.code]: (acc[row.reason.code] || 0) + 1 }), {}), [rows])
  const shown = rows.filter(({ device, reason }) => {
    if (filter !== 'all' && reason.code !== filter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [device.name, device.plate, device.imei, device.clientName, device.clientPhone]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(q))
  })

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl p-4 sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><WifiOff size={20} /></span>
          <div>
            <h1 className="text-xl font-black text-primary-500 sm:text-2xl">{isAr ? 'الأجهزة غير المتصلة' : 'Appareils hors ligne'}</h1>
            <p className="text-xs text-slate-400">{isAr ? `${rows.length} جهاز بحاجة إلى متابعة` : `${rows.length} appareil(s) à suivre`}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <Search size={16} className="text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={isAr ? 'بحث: مركبة، عميل، هاتف، IMEI' : 'Rechercher : véhicule, client, téléphone, IMEI'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              aria-label={isAr ? 'بحث' : 'Rechercher'}
            />
          </label>
        </div>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {['all', 'subscription', 'power', 'never', 'long', 'recent'].filter(code => code === 'all' || counts[code]).map(code => (
            <button
              key={code}
              type="button"
              onClick={() => setFilter(code)}
              aria-pressed={filter === code}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${filter === code ? 'border-primary-500 bg-primary-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              {code === 'all' ? (isAr ? 'الكل' : 'Tous') : (isAr ? REASONS[code].ar : REASONS[code].fr)} {code === 'all' ? rows.length : counts[code]}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
            <CheckCircle2 size={34} className="text-emerald-500" />
            <p className="mt-3 text-sm font-bold text-slate-700">{rows.length === 0 ? (isAr ? 'كل الأجهزة متصلة' : 'Tous les appareils sont connectés') : (isAr ? 'لا نتائج مطابقة' : 'Aucun résultat')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {shown.map(({ device, reason, point }) => {
              const meta = REASONS[reason.code]
              const lastContact = agoLabel(device.lastUpdate, lang)
              return (
                <article key={device.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <VehicleIcon type={device.type} iconSize={18} className="bg-slate-50" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-extrabold text-slate-900">{device.name}</h2>
                      <p className="truncate text-[11px] text-slate-400">{device.plate || '—'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${meta.color}`}>{isAr ? meta.ar : meta.fr}</span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold text-slate-400">{isAr ? 'الجهاز (IMEI)' : 'Appareil (IMEI)'}</dt>
                      <dd dir="ltr" className="truncate font-mono text-[11px] text-slate-700">{device.imei || '—'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold text-slate-400">{isAr ? 'آخر اتصال' : 'Dernier contact'}</dt>
                      <dd className="truncate font-semibold text-slate-700" title={device.lastUpdate ? new Date(device.lastUpdate).toLocaleString(isAr ? 'ar-MA' : 'fr-FR', { timeZone: APP_TZ }) : ''}>
                        {lastContact || (isAr ? 'لم يتصل قط' : 'Jamais')}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold text-slate-400">{isAr ? 'العميل' : 'Client'}</dt>
                      <dd className="truncate font-semibold text-slate-700">{device.clientName || (isAr ? 'غير مخصص' : 'Non assigné')}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold text-slate-400">{isAr ? 'هاتف العميل' : 'Téléphone'}</dt>
                      <dd className="truncate">
                        {device.clientPhone ? (
                          <a href={`tel:${device.clientPhone}`} dir="ltr" className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                            <Phone size={11} aria-hidden="true" />{device.clientPhone}
                          </a>
                        ) : <span className="text-slate-400">—</span>}
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="text-[10px] font-bold text-slate-400">{isAr ? 'آخر موقع معروف' : 'Dernière position connue'}</dt>
                      <dd className="flex flex-wrap items-center gap-2">
                        {point ? (
                          <>
                            <span dir="ltr" className="font-mono text-[11px] text-slate-700">{point[0].toFixed(5)}, {point[1].toFixed(5)}</span>
                            {agoLabel(device.locationAt, lang) && <span className="text-[10px] text-slate-400">({agoLabel(device.locationAt, lang)})</span>}
                            <a href={`https://www.google.com/maps?q=${point[0]},${point[1]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-bold text-indigo-600">
                              <MapPin size={11} aria-hidden="true" />Google Maps
                            </a>
                          </>
                        ) : <span className="text-slate-400">{isAr ? 'لا يوجد موقع صالح' : 'Aucune position valide'}</span>}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                    <span className="font-bold">{isAr ? 'السبب المرجّح: ' : 'Cause probable : '}</span>{reasonText(reason, isAr)}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/vehicle/${device.id}`)}
                    className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {isAr ? 'فتح المركبة' : 'Ouvrir le véhicule'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
