import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, Building, Mail, Phone, Plus, Trash2, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'

export default function AdminSettings() {
  const { lang } = useApp()
  const [company,  setCompany]  = useState({ name: '', supportEmail: '', supportPhone: '', logo: '' })
  const [plans,    setPlans]    = useState([])
  const [pw,       setPw]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [pwError,  setPwError]  = useState('')
  const [pwSaved,  setPwSaved]  = useState(false)

  useEffect(() => {
    api.admin.settings()
      .then(s => {
        if (s.company) setCompany(s.company)
        if (s.plans)   setPlans(s.plans)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.admin.updateSettings({ company, plans })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  const savePassword = async (e) => {
    e.preventDefault(); setPwError('')
    if (pw.newPassword !== pw.confirmPassword) return setPwError(t(lang, 'passwordMismatch'))
    try {
      await api.auth.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword })
      setPwSaved(true); setPw({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) { setPwError(err.message) }
  }

  const addPlan = () => setPlans(p => [...p, { name: '', price: 99, device_limit: 3 }])
  const removePlan = (i) => setPlans(p => p.filter((_, idx) => idx !== i))
  const updatePlan = (i, field, val) => setPlans(p => p.map((pl, idx) => idx === i ? { ...pl, [field]: val } : pl))

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-primary-500">{t(lang, 'adminSettings')}</h1>
          <button onClick={saveSettings} disabled={saving}
            className="flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl disabled:opacity-60"
            style={{ background: saved ? '#1DBF73' : '#0B1F3A' }}>
            <Save size={15} />
            {saved ? (lang === 'ar' ? 'تم الحفظ ✓' : 'Enregistré ✓') : t(lang, 'save')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1DBF73', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Company Info */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-primary-500 mb-4 flex items-center gap-2">
                <Building size={16} />{t(lang, 'companyName')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'companyName')}</label>
                  <input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))}
                    className="input-field text-sm" placeholder="Athar GPS" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'supportEmail')}</label>
                  <input type="email" value={company.supportEmail} onChange={e => setCompany(p => ({ ...p, supportEmail: e.target.value }))}
                    className="input-field text-sm" placeholder="support@athar-gps.ma" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t(lang, 'supportPhone')}</label>
                  <input type="tel" value={company.supportPhone} onChange={e => setCompany(p => ({ ...p, supportPhone: e.target.value }))}
                    className="input-field text-sm" placeholder="+212 5 XX XX XX XX" />
                </div>
              </div>
            </motion.div>

            {/* Subscription Plans */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-primary-500">{t(lang, 'subscriptionPlans')}</h2>
                <button onClick={addPlan} className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl"
                  style={{ background: '#1DBF73' }}>
                  <Plus size={13} />{t(lang, 'add')}
                </button>
              </div>
              <div className="space-y-3">
                {plans.map((plan, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <input value={plan.name} onChange={e => updatePlan(i, 'name', e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                      placeholder={t(lang, 'planName')} />
                    <div className="flex items-center gap-1">
                      <input type="number" value={plan.price} onChange={e => updatePlan(i, 'price', +e.target.value)}
                        className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none text-center"
                        placeholder="99" />
                      <span className="text-xs text-gray-400">DH</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={plan.device_limit} onChange={e => updatePlan(i, 'device_limit', +e.target.value)}
                        className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none text-center"
                        placeholder="3" />
                      <span className="text-xs text-gray-400">{lang === 'ar' ? 'جهاز' : 'app.'}</span>
                    </div>
                    <button onClick={() => removePlan(i)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Change Admin Password */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-bold text-primary-500 mb-4 flex items-center gap-2">
                <Lock size={16} />{t(lang, 'changePassword')}
              </h2>
              <form onSubmit={savePassword} className="space-y-3 max-w-sm">
                {[
                  { key: 'currentPassword', placeholder: t(lang, 'currentPassword') },
                  { key: 'newPassword',     placeholder: t(lang, 'newPassword') },
                  { key: 'confirmPassword', placeholder: t(lang, 'confirmPassword') },
                ].map(({ key, placeholder }) => (
                  <input key={key} type="password" value={pw[key]}
                    onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))} required
                    className="input-field text-sm" placeholder={placeholder} />
                ))}
                {pwError  && <p className="text-red-400 text-xs">{pwError}</p>}
                {pwSaved  && <p className="text-xs" style={{ color: '#1DBF73' }}>{t(lang, 'passwordChanged')}</p>}
                <button type="submit" className="text-white font-bold px-5 py-2.5 rounded-xl text-sm" style={{ background: '#0B1F3A' }}>
                  {t(lang, 'save')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
