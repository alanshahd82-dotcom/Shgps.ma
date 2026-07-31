import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Terminal, Wifi, Server, RefreshCw, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../i18n/translations'
import AdminLayout from './AdminLayout'

/* ─── Moroccan carrier options ─────────────────────────────────────── */
const CARRIERS = (lang) => [
  { id: 'inwi',    label: 'inwi',                  apn: 'www.inwi.ma' },
  { id: 'orange', label: 'Orange',                 apn: 'internet.orange.ma' },
  { id: 'iam',    label: 'Maroc Telecom / IAM',    apn: 'www.iamgprs.ma' },
  { id: 'custom', label: lang === 'ar' ? 'مخصص' : 'Personnalisé', apn: '' },
]

const SERVER_HOST_DEFAULT = 'athargps.com'
const SERVER_IP_DEFAULT   = '64.226.103.251'
const PORT_PRESETS        = ['5023', '5029', '5055']

/* ─── Copy button with feedback ────────────────────────────────────── */
function CopyBtn({ text, lang, small = false }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <motion.button
      onClick={handle}
      whileTap={{ scale: 0.92 }}
      className={`flex items-center gap-1.5 font-semibold rounded-xl transition-all duration-200 select-none
        ${small ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
        ${copied
          ? 'bg-accent text-white shadow-[0_0_12px_rgba(0,217,126,0.4)]'
          : 'bg-slate-700/60 hover:bg-slate-600/70 text-slate-200 border border-slate-600/40'
        }`}
    >
      <motion.span
        key={copied ? 'check' : 'copy'}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        {copied ? <Check size={small ? 12 : 14} /> : <Copy size={small ? 12 : 14} />}
      </motion.span>
      <span>{copied ? t(lang, 'ds_copied') : t(lang, 'ds_copy')}</span>
    </motion.button>
  )
}

/* ─── Single command card ───────────────────────────────────────────── */
function CommandCard({ index, label, command, lang, delay }) {
  const nums = ['①', '②', '③']
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className="group relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4
                 hover:border-accent/40 hover:bg-slate-800/70 transition-all duration-200"
    >
      {/* subtle accent glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
                      transition-opacity duration-300 pointer-events-none
                      bg-[radial-gradient(ellipse_at_60%_50%,rgba(0,217,126,0.06),transparent_70%)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-accent text-lg font-black leading-none select-none">{nums[index]}</span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
          </div>
          <code className="block font-mono text-sm text-slate-100 break-all leading-relaxed
                           bg-slate-900/60 rounded-xl px-3 py-2 border border-slate-700/40">
            {command}
          </code>
        </div>
        <CopyBtn text={command} lang={lang} />
      </div>
    </motion.div>
  )
}

/* ─── Toggle switch ─────────────────────────────────────────────────── */
function Toggle({ value, onChange, labelA, labelB }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-semibold transition-colors ${!value ? 'text-slate-100' : 'text-slate-500'}`}>{labelA}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
          ${value ? 'bg-accent' : 'bg-slate-600'}`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md
            ${value ? 'right-0.5' : 'left-0.5'}`}
        />
      </button>
      <span className={`text-xs font-semibold transition-colors ${value ? 'text-slate-100' : 'text-slate-500'}`}>{labelB}</span>
    </div>
  )
}

/* ─── Input field ───────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, mono = false }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-slate-100
                   placeholder-slate-500 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30
                   transition-all duration-150 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────────────── */
export default function DeviceSetup() {
  const { lang } = useApp()

  const carriers = CARRIERS(lang)

  const [carrierId, setCarrierId]   = useState('inwi')
  const [apn,       setApn]         = useState(carriers[0].apn)
  const [pass,      setPass]        = useState('123456')
  const [port,      setPort]        = useState('5023')
  const [useIP,     setUseIP]       = useState(false)
  const [host,      setHost]        = useState(SERVER_HOST_DEFAULT)
  const [ip,        setIp]          = useState(SERVER_IP_DEFAULT)
  const [seqCopied, setSeqCopied]   = useState(false)

  /* derive host from toggle */
  const serverHost = useIP ? ip : host

  /* commands */
  const cmd1 = `APN,${apn},${pass}#`
  const cmd2 = `SERVER,1,${serverHost},${port},0#`
  const cmd3 = `RESET,${pass}#`
  const fullSeq = `${cmd1}\n${cmd2}\n${cmd3}`

  /* sync APN when carrier changes */
  const handleCarrierChange = (id) => {
    setCarrierId(id)
    const found = carriers.find(c => c.id === id)
    if (found) setApn(found.apn)
  }

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(fullSeq) } catch { /* fallback */ }
    setSeqCopied(true)
    setTimeout(() => setSeqCopied(false), 1500)
  }

  const commandCards = [
    { label: 'APN',    cmd: cmd1 },
    { label: 'SERVER', cmd: cmd2 },
    { label: 'RESET',  cmd: cmd3 },
  ]

  return (
    <AdminLayout>
      {/* ── Page wrapper ── */}
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-slate-900 relative overflow-hidden"
        style={{ fontFamily: lang === 'ar' ? "'Cairo', 'Tajawal', sans-serif" : "'Plus Jakarta Sans', 'Inter', sans-serif" }}
      >
        {/* ambient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(#00d97e 1px,transparent 1px),linear-gradient(90deg,#00d97e 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
          {/* corner glow */}
          <div className="absolute top-0 start-0 w-96 h-96 rounded-full opacity-[0.07] blur-3xl"
            style={{ background: 'radial-gradient(circle, #00d97e 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">

          {/* ── Top status bar ── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-wrap items-center justify-between gap-3 mb-8
                       bg-slate-800/60 border border-slate-700/50 rounded-2xl px-5 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                <Terminal size={16} className="text-accent" />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-100 leading-tight">{t(lang, 'ds_title')}</h1>
                <p className="text-[11px] text-slate-400">{t(lang, 'ds_subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-bold text-accent">3 {t(lang, 'ds_cmds_ready')}</span>
            </div>
          </motion.div>

          {/* ── Main two-column layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">

            {/* ── LEFT: Inputs panel ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 space-y-5"
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'ds_config')}</p>

              {/* Carrier */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  {t(lang, 'ds_carrier')}
                </label>
                <div className="relative">
                  <select
                    value={carrierId}
                    onChange={e => handleCarrierChange(e.target.value)}
                    className="w-full appearance-none bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2.5
                               text-sm text-slate-100 focus:outline-none focus:border-accent/60 focus:ring-1
                               focus:ring-accent/30 transition-all duration-150 cursor-pointer"
                  >
                    {carriers.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute top-3 end-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* APN */}
              <Field
                label={t(lang, 'ds_apn')}
                value={apn}
                onChange={setApn}
                placeholder="www.example.ma"
                mono
              />

              {/* Device password */}
              <Field
                label={t(lang, 'ds_pass')}
                value={pass}
                onChange={setPass}
                placeholder="123456"
                mono
              />

              {/* Server address toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  {t(lang, 'ds_server_addr')}
                </label>
                <div className="mb-3">
                  <Toggle
                    value={useIP}
                    onChange={setUseIP}
                    labelA={t(lang, 'ds_domain')}
                    labelB={t(lang, 'ds_ip')}
                  />
                </div>
                {!useIP ? (
                  <Field label="" value={host} onChange={setHost} placeholder="athargps.com" mono />
                ) : (
                  <Field label="" value={ip} onChange={setIp} placeholder="64.226.103.251" mono />
                )}
              </div>

              {/* Port */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  {t(lang, 'ds_port')}
                </label>
                <div className="flex gap-2">
                  <input
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    placeholder="5023"
                    className="flex-1 bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm
                               font-mono text-slate-100 placeholder-slate-500 focus:outline-none
                               focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                  />
                  <div className="flex gap-1">
                    {PORT_PRESETS.map(p => (
                      <button
                        key={p}
                        onClick={() => setPort(p)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all duration-150
                          ${port === p
                            ? 'bg-accent text-white'
                            : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600/60 hover:text-slate-200'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Commands panel ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t(lang, 'ds_commands')}</p>
                <motion.button
                  onClick={copyAll}
                  whileTap={{ scale: 0.93 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200
                    ${seqCopied
                      ? 'bg-accent text-white shadow-[0_0_10px_rgba(0,217,126,0.4)]'
                      : 'bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/40'
                    }`}
                >
                  {seqCopied ? <Check size={12} /> : <Copy size={12} />}
                  {seqCopied ? t(lang, 'ds_copied') : t(lang, 'ds_copy_all')}
                </motion.button>
              </div>

              {commandCards.map((c, i) => (
                <CommandCard
                  key={c.label}
                  index={i}
                  label={c.label}
                  command={c.cmd}
                  lang={lang}
                  delay={0.25 + i * 0.07}
                />
              ))}

              {/* Note */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="flex items-start gap-2.5 bg-accent/5 border border-accent/15 rounded-xl px-4 py-3"
              >
                <Wifi size={14} className="text-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">{t(lang, 'ds_note')}</p>
              </motion.div>

              {/* Live preview label */}
              <div className="flex items-center gap-2 pt-1">
                <RefreshCw size={11} className="text-accent" />
                <span className="text-[10px] text-slate-500">{t(lang, 'ds_live')}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
