import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart2, Clock, Navigation, Zap, TrendingUp, Download,
  PlayCircle, ChevronDown, Calendar, Gauge, FileText, FileSpreadsheet
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import { t } from '../../i18n/translations'
import ClientNav from '../../components/ClientNav'

function StatBadge({ icon: Icon, label, value, unit, color }) {
  const colors = {
    blue:   'from-primary-500 to-primary-600',
    green:  'from-emerald-500 to-accent',
    orange: 'from-orange-400 to-orange-500',
    red:    'from-red-400 to-red-500',
  }
  return (
    <motion.div
      className={`rounded-2xl p-4 bg-gradient-to-br ${colors[color] || colors.blue} shadow-lg`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center mb-3">
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-2xl font-black text-white">{value}<span className="text-sm font-semibold ms-1 text-white/70">{unit}</span></p>
      <p className="text-white/70 text-xs mt-0.5">{label}</p>
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
        <p className="text-[10px] text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-primary-500">{payload[0].value} km/h</p>
      </div>
    )
  }
  return null
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })
}

export default function Reports() {
  const { devices, lang } = useApp()
  const [selectedDevice, setSelectedDevice] = useState('')
  const [dateFrom, setDateFrom]             = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 16)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 16))
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Clear previous results when filter changes
  useEffect(() => {
    setData(null)
    setError('')
  }, [selectedDevice, dateFrom, dateTo])

  async function loadReport() {
    if (!selectedDevice) return
    setLoading(true); setError('')
    try {
      const result = await api.reports.get(
        selectedDevice,
        new Date(dateFrom).toISOString(),
        new Date(dateTo).toISOString()
      )
      setData(result)
    } catch (err) {
      setError(lang === 'ar' ? 'فشل تحميل التقرير' : 'Échec du chargement du rapport')
    } finally { setLoading(false) }
  }

  function exportCSV() {
    if (!data) return
    const rows = [
      ['#', lang === 'ar' ? 'البداية' : 'Début', lang === 'ar' ? 'النهاية' : 'Fin',
       lang === 'ar' ? 'المدة (د)' : 'Durée (min)',
       lang === 'ar' ? 'المسافة (كم)' : 'Distance (km)',
       lang === 'ar' ? 'متوسط السرعة' : 'Vit. moy.',
       lang === 'ar' ? 'أقصى سرعة' : 'Vit. max.',
       lang === 'ar' ? 'وقت التوقف (د)' : 'Arrêt (min)'],
      ...(data.trips || []).map(tr => [
        tr.index, formatTime(tr.startTime), formatTime(tr.endTime),
        tr.durationMin, tr.distanceKm, tr.avgSpeed, tr.maxSpeed, tr.stopMin ?? 0,
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const deviceLabel = devices.find(d => String(d.id) === String(selectedDevice))?.name || selectedDevice
    const fromLabel = new Date(dateFrom).toISOString().slice(0, 10)
    const filename = lang === 'ar'
      ? `تقرير_${deviceLabel}_${fromLabel}.csv`
      : `report_${deviceLabel}_${fromLabel}.csv`
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function exportExcel() {
    if (!data?.trips?.length) return
    const deviceLabel = devices.find(d => String(d.id) === String(selectedDevice))?.name || 'device'

    const rows = data.trips.map((trip, i) => ({
      '#':             i + 1,
      'البداية':       trip.startTime ? new Date(trip.startTime).toLocaleString('ar-MA') : '—',
      'النهاية':       trip.endTime   ? new Date(trip.endTime).toLocaleString('ar-MA')   : '—',
      'المدة (د)':     trip.durationMin  ? Math.round(trip.durationMin)                  : 0,
      'المسافة (كم)':  trip.distanceKm   ? parseFloat(parseFloat(trip.distanceKm).toFixed(1)) : 0,
      'متوسط السرعة':  trip.avgSpeed  ? Math.round(trip.avgSpeed)                        : 0,
      'أقصى سرعة':    trip.maxSpeed  ? Math.round(trip.maxSpeed)                         : 0,
      'التوقف (د)':    trip.stopMin   ? Math.round(trip.stopMin)                          : 0,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'الرحلات')

    if (data.summary) {
      const summaryData = [{
        'إجمالي الرحلات':   data.trips.length,
        'إجمالي المسافة':   data.summary.totalDistance?.toFixed(1) || '0',
        'إجمالي الوقت (د)': data.summary.totalDuration ? Math.round(data.summary.totalDuration) : 0,
        'متوسط السرعة':     data.summary.avgSpeed ? Math.round(data.summary.avgSpeed) : 0,
      }]
      const ws2 = XLSX.utils.json_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, ws2, 'الملخص')
    }

    XLSX.writeFile(wb, `taqrir-${deviceLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportPDF() {
    if (!data?.trips?.length) return
    const deviceLabel = devices.find(d => String(d.id) === String(selectedDevice))?.name || selectedDevice
    const fromLabel   = new Date(dateFrom).toISOString().slice(0, 10)
    const toLabelStr  = new Date(dateTo).toISOString().slice(0, 10)

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    doc.setFontSize(16)
    doc.setTextColor(15, 32, 68)
    doc.text('Shgps.ma — تقرير الرحلات', 105, 18, { align: 'center' })
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`الجهاز: ${deviceLabel}`, 15, 28)
    doc.text(`الفترة: ${fromLabel} — ${toLabelStr}`, 15, 34)

    autoTable(doc, {
      startY: 42,
      head: [['#', 'البداية', 'النهاية', 'المدة', 'المسافة (كم)', 'متوسط السرعة', 'أقصى سرعة']],
      body: data.trips.map((trip, i) => [
        i + 1,
        trip.startTime ? new Date(trip.startTime).toLocaleString('ar-MA') : '—',
        trip.endTime   ? new Date(trip.endTime).toLocaleString('ar-MA')   : '—',
        trip.durationMin  ? `${Math.round(trip.durationMin)} د`           : '—',
        trip.distanceKm   ? parseFloat(trip.distanceKm).toFixed(1)        : '0',
        trip.avgSpeed  ? `${Math.round(trip.avgSpeed)} كم/س`              : '—',
        trip.maxSpeed  ? `${Math.round(trip.maxSpeed)} كم/س`              : '—',
      ]),
      styles:           { font: 'helvetica', fontSize: 8, halign: 'center' },
      headStyles:       { fillColor: [15, 32, 68], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      foot: [[
        '', '', 'الإجمالي',
        data.summary?.totalDuration ? `${Math.round(data.summary.totalDuration)} د` : '—',
        data.summary?.totalDistance ? `${parseFloat(data.summary.totalDistance).toFixed(1)} كم` : '—',
        '', ''
      ]],
      footStyles: { fillColor: [0, 217, 126], textColor: [15, 32, 68], fontStyle: 'bold' },
    })

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(`Shgps.ma — صفحة ${i} من ${pageCount}`, 105, 290, { align: 'center' })
    }

    doc.save(`taqrir-${deviceLabel}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const chartData = (data?.speedSeries || []).map((pt, i) => ({
    name: new Date(pt.time).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }),
    speed: pt.speed,
  }))

  const devicesForSelect = devices

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 pt-14 pb-5 px-4"
        style={{ background: 'linear-gradient(160deg, #0F2044 0%, #162d5e 100%)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <BarChart2 size={18} className="text-accent" />
          </div>
          <div>
            <h1 className="text-white font-black text-lg">
              {lang === 'ar' ? 'التقارير' : 'Rapports'}
            </h1>
            <p className="text-white/50 text-xs">
              {lang === 'ar' ? 'تحليل رحلاتك' : 'Analyse de vos trajets'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 rounded-2xl p-4 space-y-3">
          {/* Device select */}
          <div>
            <label className="text-white/60 text-xs font-semibold block mb-1">
              {lang === 'ar' ? 'الجهاز' : 'Appareil'}
            </label>
            <div className="relative">
              <select
                className="w-full bg-white/10 text-white text-sm font-medium rounded-xl px-3 py-2.5 appearance-none border border-white/20 focus:outline-none focus:border-accent"
                value={selectedDevice}
                onChange={e => setSelectedDevice(e.target.value)}
              >
                <option value="" className="text-primary-500">
                  {lang === 'ar' ? '— اختر جهازاً —' : '— Choisir un appareil —'}
                </option>
                {devicesForSelect.map(d => (
                  <option key={d.id} value={d.id} className="text-primary-500">{d.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute top-1/2 -translate-y-1/2 end-3 text-white/60 pointer-events-none" />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/60 text-[10px] font-semibold block mb-1">
                {lang === 'ar' ? 'من' : 'De'}
              </label>
              <input
                type="datetime-local"
                className="w-full bg-white/10 text-white text-xs rounded-xl px-2.5 py-2 border border-white/20 focus:outline-none focus:border-accent"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-white/60 text-[10px] font-semibold block mb-1">
                {lang === 'ar' ? 'إلى' : 'À'}
              </label>
              <input
                type="datetime-local"
                className="w-full bg-white/10 text-white text-xs rounded-xl px-2.5 py-2 border border-white/20 focus:outline-none focus:border-accent"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={loadReport}
            disabled={!selectedDevice || loading}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              selectedDevice && !loading
                ? 'bg-accent text-primary-500 hover:bg-accent-300 shadow-lg shadow-accent/20'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            ) : <PlayCircle size={15} />}
            {loading ? (lang === 'ar' ? 'جاري التحليل...' : 'Analyse...') : (lang === 'ar' ? 'تحليل' : 'Analyser')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <BarChart2 size={48} className="mb-3 opacity-30" />
            <p className="text-sm">
              {lang === 'ar' ? 'اختر جهازاً وضغط تحليل' : 'Sélectionnez un appareil et analysez'}
            </p>
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatBadge icon={Navigation} label={lang === 'ar' ? 'المسافة الإجمالية' : 'Distance totale'} value={data.totalDistanceKm} unit="km" color="blue" />
              <StatBadge icon={PlayCircle} label={lang === 'ar' ? 'عدد الرحلات' : 'Nombre de trajets'} value={data.trips?.length || 0} unit={lang === 'ar' ? 'رحلة' : 'trajet(s)'} color="green" />
              <StatBadge icon={Clock} label={lang === 'ar' ? 'وقت الحركة' : 'Temps de mouvement'} value={formatDuration(data.movingDurationMin)} unit="" color="orange" />
              <StatBadge icon={Gauge} label={lang === 'ar' ? 'أقصى سرعة' : 'Vitesse max'} value={data.maxSpeed} unit="km/h" color="red" />
            </div>

            {/* Speed chart */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-primary-500 text-sm">
                    {lang === 'ar' ? 'منحنى السرعة' : 'Courbe de vitesse'}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <TrendingUp size={12} />
                    {lang === 'ar' ? 'متوسط' : 'Moy.'}: {data.avgSpeed} km/h
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00D97E" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00D97E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} unit=" km/h" width={50} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="speed" stroke="#00D97E" strokeWidth={2} fill="url(#speedGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trips table */}
            {data.trips && data.trips.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-primary-500 text-sm">
                    {lang === 'ar' ? 'تفاصيل الرحلات' : 'Détail des trajets'}
                  </h3>
                  <div className="flex gap-1.5">
                    <button onClick={exportCSV}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                      <Download size={11} /> CSV
                    </button>
                    <button onClick={exportExcel}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                      <FileSpreadsheet size={11} /> XLS
                    </button>
                    <button onClick={exportPDF}
                      className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                      <FileText size={11} /> PDF
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                  {data.trips.map(trip => (
                    <motion.div
                      key={trip.index}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: trip.index * 0.04 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-primary-50 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-primary-500">{trip.index}</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-primary-500">
                              {formatTime(trip.startTime)} — {formatTime(trip.endTime)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatDuration(trip.durationMin)} · {trip.avgSpeed} km/h {lang === 'ar' ? 'متوسط' : 'moy.'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-accent">{trip.distanceKm} km</p>
                          <p className="text-[10px] text-slate-400">{lang === 'ar' ? 'أقصى' : 'max'}: {trip.maxSpeed} km/h</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {data.trips && data.trips.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Navigation size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-slate-400 text-sm">
                  {lang === 'ar' ? 'لا توجد رحلات في هذه الفترة' : 'Aucun trajet sur cette période'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <ClientNav />
    </div>
  )
}
