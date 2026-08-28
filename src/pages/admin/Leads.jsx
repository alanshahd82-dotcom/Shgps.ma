import React, { useEffect, useState } from 'react'
import { Inbox, Phone, Mail, MessageSquare, Package, Clock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'
import { APP_TZ } from '../../utils/datetime.js'

function timeAgo(iso, lang) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1) return lang === 'ar' ? 'الآن' : "À l'instant"
  if (diff < 60) return `${diff} ${lang === 'ar' ? 'د' : 'min'}`
  if (diff < 1440) return `${Math.floor(diff / 60)} ${lang === 'ar' ? 'س' : 'h'}`
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', { timeZone: APP_TZ })
}

export default function Leads() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.leads.list()
      .then(data => { setLeads(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Inbox size={22} className="text-primary-500" />
          <div>
            <h1 className="text-2xl font-black text-primary-500">
              {isAr ? 'طلبات التواصل' : 'Demandes de contact'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {leads.length} {isAr ? 'طلب' : 'demande(s)'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl text-sm text-center text-red-500 bg-red-50">{error}</div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 text-slate-400">
            <Inbox size={36} className="mb-2 opacity-30" />
            <p className="text-sm">{isAr ? 'لا توجد طلبات بعد' : 'Aucune demande pour le moment'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={isAr ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    <th className="px-5 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {isAr ? 'الاسم' : 'Nom'}
                    </th>
                    <th className="px-5 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {isAr ? 'الهاتف' : 'Téléphone'}
                    </th>
                    <th className="px-5 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {isAr ? 'البريد' : 'Email'}
                    </th>
                    <th className="px-5 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {isAr ? 'الباقة' : 'Forfait'}
                    </th>
                    <th className="px-5 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {isAr ? 'الرسالة' : 'Message'}
                    </th>
                    <th className="px-5 py-3 text-start text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {isAr ? 'التاريخ' : 'Date'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr key={lead.id} className={`border-b border-gray-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                      <td className="px-5 py-3.5 font-semibold text-primary-500">{lead.name || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Phone size={12} className="text-slate-400" />
                          {lead.phone || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {lead.email
                          ? <span className="inline-flex items-center gap-1.5 text-slate-600"><Mail size={12} className="text-slate-400" />{lead.email}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {lead.package
                          ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-accent/10 text-primary-500"><Package size={10} />{lead.package}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 max-w-[260px]">
                        {lead.message
                          ? <span className="flex items-start gap-1.5 text-slate-600 text-xs leading-relaxed">
                              <MessageSquare size={12} className="text-slate-400 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{lead.message}</span>
                            </span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} />
                          {timeAgo(lead.created_at, lang)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
