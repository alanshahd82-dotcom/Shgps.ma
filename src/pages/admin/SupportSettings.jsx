import React, { useEffect, useState } from 'react'
import { Mail, Phone, MessageCircle, Save, TriangleAlert, Play, Apple } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { api } from '../../api/index.js'
import { useApp } from '../../context/AppContext'

const DEFAULT_SUPPORT = {
  email: 'support@athargps.ma',
  phone: '+212600000000',
  whatsapp: '212600000000',
  hours: 'كل يوم من 09:00 إلى 18:00',
  googlePlayUrl: '',
  appStoreUrl: '',
}

export default function SupportSettings() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [form, setForm] = useState(DEFAULT_SUPPORT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.settings.support().then(setForm).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }))
  async function save(event) {
    event.preventDefault()
    setSaving(true); setMessage('')
    try {
      setForm(await api.adminSettings.support(form))
      setMessage(isAr ? 'تم حفظ بيانات الدعم ✓' : 'Contacts enregistrés ✓')
    } catch (error) {
      setMessage(error.message)
    } finally { setSaving(false) }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-black text-primary-500">{isAr ? 'بيانات الدعم' : 'Contacts du support'}</h1>
        <p className="text-slate-400 text-sm mt-1 mb-6">
          {isAr ? 'غيّر الأرقام والبريد الظاهرين للعملاء من هنا.' : 'Modifiez les contacts visibles par les clients.'}
        </p>
        <div className="flex gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 mb-5">
          <TriangleAlert size={18} className="flex-shrink-0" />
          <p className="text-xs leading-5">
            {isAr
              ? 'هذه البيانات تظهر للعميل في صفحة الهبوط ومركز المساعدة. حدّثها من هنا عند الحاجة.'
              : 'Ces coordonnées sont visibles sur la page d’accueil et dans l’aide client. Modifiez-les ici si nécessaire.'}
          </p>
        </div>
        <form onSubmit={save} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          {[
            ['email', isAr ? 'البريد الإلكتروني' : 'Email', Mail, 'support@athargps.ma', 'email'],
            ['phone', isAr ? 'رقم الهاتف' : 'Téléphone', Phone, '+212600000000', 'tel'],
            ['whatsapp', 'WhatsApp', MessageCircle, '212600000000', 'text'],
            ['hours', isAr ? 'ساعات العمل' : 'Horaires', null, '09:00 - 18:00', 'text'],
            ['googlePlayUrl', isAr ? 'رابط Google Play' : 'Lien Google Play', Play, 'https://play.google.com/store/apps/details?id=...', 'url'],
            ['appStoreUrl', isAr ? 'رابط App Store' : 'Lien App Store', Apple, 'https://apps.apple.com/app/...', 'url'],
          ].map(([key, label, Icon, placeholder, type]) => (
            <label key={key} className="block">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
                {Icon && <Icon size={15} className="text-accent" />}{label}
              </span>
              <input required={key !== 'googlePlayUrl' && key !== 'appStoreUrl'} value={form[key] || ''} onChange={update(key)} type={type} placeholder={placeholder}
                disabled={loading} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-primary-500 outline-none focus:border-accent" />
              {key === 'whatsapp' && <span className="text-[11px] text-slate-400 mt-1 block">{isAr ? 'اكتب الرقم الدولي دون + أو مسافات' : 'Format international sans + ni espaces'}</span>}
              {(key === 'googlePlayUrl' || key === 'appStoreUrl') && <span className="text-[11px] text-slate-400 mt-1 block">{isAr ? 'اتركه فارغاً حتى يصبح التطبيق منشوراً في المتجر.' : 'Laissez vide jusqu’à la publication de l’application.'}</span>}
            </label>
          ))}
          {message && <p className={`text-sm ${message.includes('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{message}</p>}
          <button type="submit" disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            <Save size={16} />{saving ? '...' : (isAr ? 'حفظ البيانات' : 'Enregistrer')}
          </button>
        </form>
      </div>
    </AdminLayout>
  )
}