import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, Loader2, Lock, X } from 'lucide-react'

// Engine cut / resume must be confirmed with the password of the signed-in
// account. The server checks it; this dialog only collects it. A wrong password
// keeps the dialog open with the reason and never sends anything.

const TEXT = {
  ar: {
    cutTitle: 'تأكيد قطع المحرك',
    startTitle: 'تأكيد تشغيل المحرك',
    body: 'أدخل كلمة سر حسابك لتنفيذ الأمر.',
    queued: 'المركبة بلا إشارة الآن: يُحفظ الأمر وينفَّذ تلقائياً عند عودة الإشارة.',
    label: 'كلمة السر',
    show: 'إظهار كلمة السر',
    hide: 'إخفاء كلمة السر',
    cancel: 'إلغاء',
    cutAction: 'قطع المحرك',
    startAction: 'تشغيل المحرك',
    close: 'إغلاق',
  },
  fr: {
    cutTitle: 'Confirmer la coupure du moteur',
    startTitle: 'Confirmer le démarrage du moteur',
    body: 'Saisissez le mot de passe de votre compte pour exécuter la commande.',
    queued: "Le véhicule n'a pas de signal : la commande est gardée et exécutée automatiquement au retour du signal.",
    label: 'Mot de passe',
    show: 'Afficher le mot de passe',
    hide: 'Masquer le mot de passe',
    cancel: 'Annuler',
    cutAction: 'Couper le moteur',
    startAction: 'Démarrer le moteur',
    close: 'Fermer',
  },
}

export default function EnginePasswordModal({ open, lang = 'ar', turnOff, name, offline = false, sending = false, error = '', onCancel, onSubmit }) {
  const l = TEXT[lang === 'fr' ? 'fr' : 'ar']
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setPassword(''); setVisible(false)
      const id = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(id)
    }
    setPassword('')
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = e => { if (e.key === 'Escape' && !sending) onCancel?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, sending, onCancel])

  if (!open) return null

  const submit = e => {
    e?.preventDefault()
    if (!password || sending) return
    onSubmit?.(password)
  }

  const node = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={turnOff ? l.cutTitle : l.startTitle} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget && !sending) onCancel?.() }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl" dir={lang === 'fr' ? 'ltr' : 'rtl'} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${turnOff ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}><Lock size={20} /></span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{turnOff ? l.cutTitle : l.startTitle}</h2>
              {name ? <p className="mt-0.5 text-xs text-slate-500">{name}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={sending} aria-label={l.close} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50"><X size={17} /></button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">{l.body}</p>
        {offline && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-5 text-amber-800">{l.queued}</p>}

        <label className="mt-4 block text-[11px] font-bold text-slate-500" htmlFor="engine-password">{l.label}</label>
        <div className="relative mt-1" dir="ltr">
          <input
            id="engine-password"
            ref={inputRef}
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            dir="ltr"
            disabled={sending}
            aria-invalid={error ? 'true' : 'false'}
            className={`w-full rounded-xl border bg-white px-3 py-3 pe-11 text-sm text-slate-900 outline-none focus:ring-2 ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-200'}`}
          />
          <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? l.hide : l.show} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error ? <p role="alert" className="mt-2 text-[12px] font-bold text-red-600">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} disabled={sending} className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-xs font-extrabold text-slate-600">{l.cancel}</button>
          <button type="submit" disabled={!password || sending} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold text-white transition disabled:opacity-50 ${turnOff ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : null}
            {turnOff ? l.cutAction : l.startAction}
          </button>
        </div>
      </form>
    </div>
  )
  // Portal: the card that opens it has a 3D perspective that would break `fixed` positioning.
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node
}
