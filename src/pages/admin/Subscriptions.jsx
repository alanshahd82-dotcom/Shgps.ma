import React, { useState } from 'react'
import { Search, RefreshCw, AlertCircle, CreditCard } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { getSubscriptionSnapshot, getSubscriptionPlan } from '../../utils/subscriptions'
import AdminLayout from './AdminLayout'
import SubscriptionBadge from '../../components/SubscriptionBadge'
import SubscriptionRenewalModal from '../../components/SubscriptionRenewalModal'

const STATUS_FILTERS = [
  { id: 'all',            labelAr: 'الكل',           labelFr: 'Tous' },
  { id: 'active',        labelAr: 'نشط',           labelFr: 'Actif' },
  { id: 'expiring_soon', labelAr: 'ينتهي قريباً', labelFr: 'Expire bientôt' },
  { id: 'expired',       labelAr: 'منتهي',       labelFr: 'Expiré' },
  { id: 'unassigned',    labelAr: 'غير محدد',     labelFr: 'Non assigné' },
]

export default function Subscriptions() {
  const { devices, lang, devicesLoading, refreshDevices, clientsError } = useApp()
  const isAr = lang === 'ar'
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [renewDevice, setRenewDevice] = useState(null)

  const filtered = devices.filter(d => {
    const snap = getSubscriptionSnapshot(d)
    if (statusFilter !== 'all' && snap.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        d.name?.toLowerCase().includes(q) ||
        d.imei?.toLowerCase().includes(q) ||
        d.plate?.toLowerCase().includes(q) ||
        d.client_name?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const stats = devices.reduce((acc, d) => {
    const snap = getSubscriptionSnapshot(d)
    acc[snap.status] = (acc[snap.status] || 0) + 1
    return acc
  }, {})

  return (
    <AdminLayout>
      <SubscriptionRenewalModal
        open={!!renewDevice}
        device={renewDevice}
        lang={lang}
        onClose={() => setRenewDevice(null)}
        onSaved={() => { setRenewDevice(null); refreshDevices?.() }}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-500">
              {isAr ? 'الاشتراكات' : 'Abonnements'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {devices.length} {isAr ? 'جهاز مسجّل' : 'appareil(s) enregistré(s)'}
            </p>
          </div>
          <button
            onClick={refreshDevices}
            disabled={devicesLoading}
            className="flex items-center gap-2 bg-teal-50 text-teal-700 border border-teal-200 font-semibold px-4 py-2.5 rounded-xl hover:bg-teal-100 transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={devicesLoading ? 'animate-spin' : ''} />
            {devicesLoading
              ? (isAr ? 'تحديث...' : 'Actualisation...')
              : (isAr ? 'تحديث' : 'Actualiser')}
          </button>
        </div>

        {/* Error state */}
        {clientsError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100 mb-4">
            <AlertCircle size={14} />
            {isAr ? 'تعذر تحميل بعض البيانات' : 'Impossible de charger certaines données'}
          </div>
        )}

        {/* Search + Status filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-4 text-slate-400" />
            <input
              className="input-field ps-10"
              placeholder={isAr ? 'بحث بالاسم، IMEI، اللوحة، العميل...' : 'Rechercher par nom, IMEI, plaque, client...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  statusFilter === f.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-slate-500 border border-gray-200 hover:bg-slate-50'
                }`}
              >
                {isAr ? f.labelAr : f.labelFr}
                {f.id !== 'all' && stats[f.id] != null && (
                  <span className="opacity-70 ms-1">{stats[f.id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {devicesLoading && !devices.length ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-primary-500 animate-spin" />
          </div>
        ) : !filtered.length ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CreditCard size={40} className="text-slate-300 mb-3" />
            <p className="text-slate-400 font-semibold">
              {isAr ? 'لا توجد اشتراكات' : 'Aucun abonnement'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {isAr ? 'لم يتم العثور على أجهزة مطابقة' : 'Aucun appareil correspondant trouvé'}
            </p>
          </div>
        ) : (
          /* Table — desktop */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-gray-100">
                  <tr>
                    {[
                      isAr ? 'الجهاز' : 'Appareil',
                      'IMEI',
                      isAr ? 'العميل' : 'Client',
                      isAr ? 'الخطة' : 'Forfait',
                      isAr ? 'تاريخ البداية' : 'Début',
                      isAr ? 'تاريخ الانتهاء' : 'Fin',
                      isAr ? 'الحالة' : 'Statut',
                      '',
                    ].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(d => {
                    const snap = getSubscriptionSnapshot(d)
                    const plan = getSubscriptionPlan(snap.planId)
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-primary-500 text-sm">{d.name || '—'}</div>
                          {d.plate && <div className="text-xs text-slate-400">{d.plate}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">{d.imei || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{d.client_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {plan ? (isAr ? plan.label : plan.labelFr) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{snap.startDate || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{snap.endDate || '—'}</td>
                        <td className="px-4 py-3"><SubscriptionBadge device={d} lang={lang} /></td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setRenewDevice(d)}
                            className="flex items-center gap-1.5 bg-primary-50 text-primary-600 border border-primary-100 font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors text-xs"
                          >
                            <RefreshCw size={12} />
                            {isAr ? 'تجديد' : 'Renouveler'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile */}
            <div className="lg:hidden divide-y divide-gray-50">
              {filtered.map(d => {
                const snap = getSubscriptionSnapshot(d)
                const plan = getSubscriptionPlan(snap.planId)
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-primary-500 text-sm">{d.name || '—'}</div>
                        <div className="text-xs text-slate-400 font-mono">{d.imei || '—'}</div>
                      </div>
                      <SubscriptionBadge device={d} lang={lang} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div><span className="text-slate-400">{isAr ? 'العميل' : 'Client'}: </span><span className="text-slate-600">{d.client_name || '—'}</span></div>
                      <div><span className="text-slate-400">{isAr ? 'الخطة' : 'Forfait'}: </span><span className="text-slate-600">{plan ? (isAr ? plan.label : plan.labelFr) : '—'}</span></div>
                      <div><span className="text-slate-400">{isAr ? 'البداية' : 'Début'}: </span><span className="text-slate-600">{snap.startDate || '—'}</span></div>
                      <div><span className="text-slate-400">{isAr ? 'الانتهاء' : 'Fin'}: </span><span className="text-slate-600">{snap.endDate || '—'}</span></div>
                    </div>
                    <button
                      onClick={() => setRenewDevice(d)}
                      className="w-full flex items-center justify-center gap-1.5 bg-primary-50 text-primary-600 border border-primary-100 font-semibold px-3 py-2 rounded-lg hover:bg-primary-100 transition-colors text-xs"
                    >
                      <RefreshCw size={12} />
                      {isAr ? 'تجديد الاشتراك' : 'Renouveler'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
