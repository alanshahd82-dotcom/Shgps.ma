import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, LogIn, Home } from 'lucide-react'
import { useApp } from '../context/AppContext'

const COPY = {
  ar: {
    code: '404',
    title: 'الصفحة غير موجودة',
    body: 'عذراً، هذا الرابط غير موجود أو تم نقله.',
    home: 'الصفحة الرئيسية',
    login: 'تسجيل الدخول',
  },
  fr: {
    code: '404',
    title: 'Page introuvable',
    body: 'Désolé, ce lien n\u2019existe pas ou a été déplacé.',
    home: 'Page d\u2019accueil',
    login: 'Se connecter',
  },
}

export default function NotFound() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const copy = COPY[lang] || COPY.ar

  useEffect(() => {
    document.title = `404 — ATHAR GPS`
    return () => { document.title = 'ATHAR GPS' }
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#f5f7f8] px-6 text-center"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Icon */}
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-md">
        <MapPin size={44} className="text-accent" />
      </div>

      {/* 404 code */}
      <p className="text-7xl font-black tracking-tight text-primary-500 opacity-10 leading-none select-none">
        {copy.code}
      </p>

      {/* Title */}
      <h1 className="mt-4 text-xl font-extrabold text-primary-500">
        {copy.title}
      </h1>

      {/* Body */}
      <p className="mt-2 max-w-xs text-sm text-slate-500 leading-6">
        {copy.body}
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Home size={16} />
          {copy.home}
        </Link>
        <Link
          to="/client/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-primary-500 shadow-sm transition-colors hover:border-primary-500"
        >
          <LogIn size={16} />
          {copy.login}
        </Link>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-slate-400">
        © {new Date().getFullYear()} ATHAR GPS · Fleet intelligence
      </p>
    </div>
  )
}
