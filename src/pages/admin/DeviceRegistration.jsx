import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Copy } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'

export default function DeviceRegistration() {
  const navigate = useNavigate()
  const { lang, clientList } = useApp()
  const [form, setForm] = useState({ name: '', imei: '', type: 'car', plate: '', protocol: 'GT06', clientId: '' })
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')
  const [copied,   setCopied]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    setLoading(true)
    try {
      const data = await api.admin.registerDevice({ ...form, clientId: form.clientId || undefined })
      setResult(data)
    } catch (err) {
      setError(err.message || t(lang, 'error'))
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(result.activationCode)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin/devices')}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center">
            <ArrowLeft size={16} className="text-gray-500" />
          </button>
          <h1 className="text-2xl font-black text-primary-500">{t(lang, 'registerDevice')}</h1>
        </div>

        {result ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center space-y-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#1DBF7320' }}>
              <CheckCircle size={36} style={{ color: '#1DBF73' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary-500 mb-1">{lang === 'ar' ? 'تم تسجيل الجهاز بنجاح' : 'Appareil enregistré avec succès'}</h2>
              <p className="text-gray-400 text-sm">{result.name} — {result.imei}</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-5">
              <p className="text-xs text-gray-400 mb-2">{t(lang, 'activationCode')}</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black tracking-[0.4em] text-primary-500">{result.activationCode}</span>
                <button onClick={copyCode} className="p-2 rounded-xl transition-all" style={{ background: copied ? '#1DBF7320' : '#F1F5F9' }}>
                  <Copy size={16} style={{ color: copied ? '#1DBF73' : '#94A3B8' }} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">{lang === 'ar' ? 'أعطِ هذا الرمز للعميل لتفعيل الجهاز' : 'Donnez ce code au client pour activer l\'appareil'}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setResult(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm">
                {lang === 'ar' ? 'تسجيل جهاز آخر' : 'Enregistrer un autre'}
              </button>
              <button onClick={() => navigate('/admin/devices')}
                className="flex-1 text-white font-bold py-3 rounded-xl text-sm" style={{ background: '#0B1F3A' }}>
                {lang === 'ar' ? 'قائمة الأجهزة' : 'Liste des appareils'}
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'deviceName')} *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                  className="input-field text-sm" placeholder={lang === 'ar' ? 'سيارة محمد - تويوتا' : 'Voiture Ahmed - Toyota'} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'imei')} *</label>
                <input value={form.imei} onChange={e => setForm(p => ({ ...p, imei: e.target.value }))} required
                  maxLength={20} className="input-field text-sm" placeholder="358900001234567" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'deviceType')}</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="input-field text-sm">
                  <option value="car">{lang === 'ar' ? 'سيارة' : 'Voiture'}</option>
                  <option value="bike">{lang === 'ar' ? 'دراجة' : 'Moto'}</option>
                  <option value="truck">{lang === 'ar' ? 'شاحنة' : 'Camion'}</option>
                  <option value="other">{lang === 'ar' ? 'أخرى' : 'Autre'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{lang === 'ar' ? 'لوحة الترقيم' : 'Immatriculation'}</label>
                <input value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value }))}
                  className="input-field text-sm" placeholder="A 12345 XX" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'protocol')}</label>
                <select value={form.protocol} onChange={e => setForm(p => ({ ...p, protocol: e.target.value }))} className="input-field text-sm">
                  {['GT06', 'GS900', 'Wanway', 'Teltonika', 'Concox'].map(pr => (
                    <option key={pr} value={pr}>{pr}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t(lang, 'client')} ({lang === 'ar' ? 'اختياري' : 'optionnel'})</label>
                <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} className="input-field text-sm">
                  <option value="">{lang === 'ar' ? 'بدون عميل (سيُسند لاحقاً)' : 'Sans client (assigné plus tard)'}</option>
                  {clientList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-60"
              style={{ background: '#0B1F3A' }}>
              {loading ? t(lang, 'loading') : t(lang, 'registerDevice')}
            </button>
          </form>
        )}
      </div>
    </AdminLayout>
  )
}
