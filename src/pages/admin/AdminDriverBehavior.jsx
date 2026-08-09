import React, { useEffect, useState } from 'react'
import { Gauge, CheckCircle2, AlertCircle, ChevronDown, Car, BarChart2, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import AdminLayout from './AdminLayout'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ScoreBadge({ score }) {
  const color = score >= 80 ? '#16866d' : score >= 60 ? '#b06b1b' : '#b64949'
  const bg    = score >= 80 ? '#dcfce7' : score >= 60 ? '#fef9c3' : '#fee2e2'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: bg, color }}>
      {score}/100
    </span>
  )
}

export default function AdminDriverBehavior() {
  const { lang } = useApp()
  const isAr = lang === 'ar'

  /* ── devices ── */
  const [devices, setDevices] = useState([])
  const [devLoading, setDevLoading] = useState(true)

  /* ── selected device + scores ── */
  const [deviceId, setDeviceId] = useState('')
  const [showDevices, setShowDevices] = useState(false)
  const [scores, setScores] = useState([])
  const [scoresLoading, setScoresLoading] = useState(false)

  /* ── form ── */
  const [score, setScore] = useState('')
  const [speedingEvents, setSpeedingEvents] = useState('')
  const [idleMin, setIdleMin] = useState('')
  const [tripCount, setTripCount] = useState('')

  /* ── submit state ── */
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  /* load devices on mount */
  useEffect(() => {
    api.devices.list()
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setDevices(list)
        if (list.length > 0) setDeviceId(String(list[0].id))
        setDevLoading(false)
      })
      .catch(() => setDevLoading(false))
  }, [])

  /* load recent scores when device changes */
  useEffect(() => {
    if (!deviceId) return
    setScoresLoading(true)
    api.driverBehavior.getScores(deviceId, 30)
      .then(data => { setScores(Array.isArray(data) ? data : []); setScoresLoading(false) })
      .catch(() => setScoresLoading(false))
  }, [deviceId])

  const selectedDevice = devices.find(d => String(d.id) === deviceId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const s = Number(score)
    if (!deviceId) { setError(isAr ? 'اختر جهازاً' : 'Sélectionnez un appareil'); return }
    if (isNaN(s) || s < 0 || s > 100) { setError(isAr ? 'الدرجة يجب أن تكون بين 0 و 100' : 'Le score doit être entre 0 et 100'); return }
    setSaving(true); setError(''); setSuccess(false)
    try {
      await api.driverBehavior.saveScore(deviceId, {
        score: s,
        speedingEvents: speedingEvents !== '' ? Number(speedingEvents) : 0,
        idleMin:        idleMin        !== '' ? Number(idleMin)        : 0,
        tripCount:      tripCount      !== '' ? Number(tripCount)      : 0,
      })
      setSuccess(true)
      setScore(''); setSpeedingEvents(''); setIdleMin(''); setTripCount('')
      /* refresh the score list */
      const data = await api.driverBehavior.getScores(deviceId, 30)
      setScores(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || (isAr ? 'حدث خطأ' : 'Erreur'))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-primary-500 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-200"

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Gauge size={22} className="text-primary-500" />
          <div>
            <h1 className="text-2xl font-black text-primary-500">
              {isAr ? 'إدخال درجة سلوك السائق' : 'Saisie score comportement conducteur'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {isAr
                ? 'أدخل درجة السلوك يدوياً لكل جهاز — سجل واحد يومياً لكل جهاز'
                : 'Saisissez un score par appareil · Un enregistrement par jour'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Left: entry form ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {isAr ? 'إضافة / تحديث درجة اليوم' : "Ajouter / mettre à jour le score d'aujourd'hui"}
            </p>

            {devLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

                {/* Device selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    {isAr ? 'الجهاز' : 'Appareil'}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDevices(s => !s)}
                      aria-expanded={showDevices}
                      className={inputCls + " flex items-center justify-between"}
                    >
                      <span className="flex items-center gap-2">
                        <Car size={14} className="text-primary-500" />
                        {selectedDevice?.name || (isAr ? 'اختر جهازاً' : 'Choisir')}
                      </span>
                      <ChevronDown size={14} className="text-slate-400"
                        style={{ transform: showDevices ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    {showDevices && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {devices.length === 0
                          ? <p className="px-4 py-3 text-xs text-slate-400">{isAr ? 'لا توجد أجهزة' : 'Aucun appareil'}</p>
                          : devices.map(d => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => { setDeviceId(String(d.id)); setShowDevices(false); setSuccess(false) }}
                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors"
                                style={{ color: String(d.id) === deviceId ? '#17324d' : '#64748b', borderBottom: '1px solid #f1f5f9' }}
                              >
                                {d.name} <span className="text-xs text-slate-400 ml-1">{d.imei}</span>
                              </button>
                            ))
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    {isAr ? 'درجة السلوك (0 – 100)' : 'Score comportement (0 – 100)'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number" min="0" max="100" required
                    value={score} onChange={e => setScore(e.target.value)}
                    placeholder={isAr ? 'مثال: 85' : 'Ex : 85'}
                    className={inputCls}
                  />
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      {isAr ? 'تجاوز السرعة' : 'Excès vitesse'}
                    </label>
                    <input type="number" min="0" value={speedingEvents} onChange={e => setSpeedingEvents(e.target.value)}
                      placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      {isAr ? 'دقائق الخمول' : 'Min ralenti'}
                    </label>
                    <input type="number" min="0" value={idleMin} onChange={e => setIdleMin(e.target.value)}
                      placeholder="0" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">
                      {isAr ? 'الرحلات' : 'Trajets'}
                    </label>
                    <input type="number" min="0" value={tripCount} onChange={e => setTripCount(e.target.value)}
                      placeholder="0" className={inputCls} />
                  </div>
                </div>

                {/* Feedback */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-600 text-xs">
                    <CheckCircle2 size={14} />
                    {isAr ? 'تم الحفظ بنجاح ✓' : 'Enregistré avec succès ✓'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !deviceId}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: saving ? '#94a3b8' : '#17324d', cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving
                    ? (isAr ? 'جاري الحفظ...' : 'Enregistrement...')
                    : (isAr ? 'حفظ الدرجة' : 'Enregistrer le score')}
                </button>

                <p className="text-[11px] text-slate-400 text-center">
                  {isAr
                    ? 'يُحفظ سجل واحد يومياً لكل جهاز — سيتم تحديث درجة اليوم إن وُجدت'
                    : 'Un seul enregistrement par jour et par appareil — la saisie du jour sera mise à jour si elle existe déjà'}
                </p>
              </form>
            )}
          </div>

          {/* ── Right: recent scores ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                {isAr ? 'آخر 30 يوم' : '30 derniers jours'}
              </p>
              <button
                onClick={() => {
                  if (!deviceId) return
                  setScoresLoading(true)
                  api.driverBehavior.getScores(deviceId, 30)
                    .then(data => { setScores(Array.isArray(data) ? data : []); setScoresLoading(false) })
                    .catch(() => setScoresLoading(false))
                }}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                title={isAr ? 'تحديث' : 'Rafraîchir'}
              >
                <RefreshCw size={13} className="text-slate-500" />
              </button>
            </div>

            {scoresLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              </div>
            ) : scores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <BarChart2 size={30} className="mb-2 opacity-30" />
                <p className="text-xs">{isAr ? 'لا توجد سجلات بعد' : 'Aucun enregistrement'}</p>
                <p className="text-xs mt-1 text-slate-300">
                  {isAr ? 'استخدم النموذج للإضافة' : 'Utilisez le formulaire pour ajouter'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir={isAr ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50">
                      <th className="px-3 py-2 text-start text-xs font-bold text-slate-400 uppercase">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="px-3 py-2 text-start text-xs font-bold text-slate-400 uppercase">{isAr ? 'الدرجة' : 'Score'}</th>
                      <th className="px-3 py-2 text-start text-xs font-bold text-slate-400 uppercase">{isAr ? 'تجاوز سرعة' : 'Excès'}</th>
                      <th className="px-3 py-2 text-start text-xs font-bold text-slate-400 uppercase">{isAr ? 'رحلات' : 'Trajets'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(row.recorded_date)}</td>
                        <td className="px-3 py-2.5"><ScoreBadge score={row.score} /></td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{row.speeding_events ?? 0}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">{row.trip_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
