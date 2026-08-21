import React, { useEffect, useState } from 'react'
import { Mail, Phone, MessageCircle, ChevronDown, CircleHelp } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/index.js'
import ClientNav from '../../components/ClientNav'
import ClientHeader from '../../components/ClientHeader'
import { DEFAULT_SUPPORT } from '../../config/support.js'

const FAQ_AR = [
  ['كيف أرى مركبتي؟', 'افتح الخريطة المباشرة أو اضغط على أجهزتي ثم اختر المركبة.'],
  ['لماذا تظهر المركبة غير متصلة؟', 'تحقق من شريحة SIM والكهرباء، ثم تواصل مع الدعم إذا استمر الانقطاع.'],
  ['كيف أجدد الاشتراك؟', 'افتح تفاصيل المركبة واضغط على تجديد الاشتراك، ثم تواصل مع المسؤول لإتمام الأداء.'],
  ['هل يمكنني مشاركة الموقع؟', 'من تفاصيل المركبة افتح مشاركة وأنشئ رابطًا مؤقتًا للموقع المباشر.'],
  ['هل يمكن إيقاف المحرك؟', 'نعم عند توفر جهاز يدعم الأمر. استخدمه فقط في مكان آمن وبعد التأكد من المركبة.'],
]

const FAQ_FR = [
  ['Comment voir mon véhicule ?', 'Ouvrez la carte en direct ou choisissez un véhicule dans Mes appareils.'],
  ['Pourquoi le véhicule est hors ligne ?', 'Vérifiez la SIM et l’alimentation, puis contactez le support si le problème continue.'],
  ['Comment renouveler ?', 'Ouvrez les détails du véhicule, choisissez le renouvellement puis contactez l’administrateur.'],
  ['Puis-je partager la position ?', 'Dans les détails du véhicule, ouvrez Partager et créez un lien temporaire.'],
  ['Puis-je couper le moteur ?', 'Oui si votre appareil le permet. Utilisez cette commande uniquement dans un lieu sûr.'],
]

export default function Help() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [support, setSupport] = useState(DEFAULT_SUPPORT)
  const [open, setOpen] = useState(0)

  useEffect(() => {
    api.settings.support().then(setSupport).catch(() => {})
  }, [])

  const faq = isAr ? FAQ_AR : FAQ_FR
  const whatsapp = `https://wa.me/${String(support.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(isAr ? 'مرحباً، أحتاج مساعدة في ATHAR GPS' : 'Bonjour, j’ai besoin d’aide avec ATHAR GPS')}`

  return (
    <div className="client-app min-h-screen bg-[#f5f7f8] pb-28 px-5" dir={isAr ? 'rtl' : 'ltr'}>
      <ClientHeader />
      <header className="pt-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,217,126,0.13)' }}>
            <CircleHelp size={23} color="#00D97E" />
          </div>
          <div>
            <h1 className="text-indigo-600 font-extrabold text-xl">{isAr ? 'مركز المساعدة' : 'Centre d’aide'}</h1>
            <p className="text-xs mt-1 text-slate-500">
              {isAr ? 'إجابات سريعة وطرق التواصل مع فريق الدعم' : 'Réponses rapides et contacts du support'}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-2.5 mb-6">
        <a href={`tel:${support.phone}`} className="p-3 rounded-2xl text-center"
           style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <Phone size={19} className="mx-auto mb-2" color="#00D97E" />
           <span className="block text-[11px] text-slate-800 font-semibold">{isAr ? 'اتصال' : 'Appeler'}</span>
        </a>
        <a href={`mailto:${support.email}`} className="p-3 rounded-2xl text-center"
           style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <Mail size={19} className="mx-auto mb-2" color="#3B82F6" />
           <span className="block text-[11px] text-slate-800 font-semibold">{isAr ? 'إيميل' : 'Email'}</span>
        </a>
        <a href={whatsapp} target="_blank" rel="noreferrer" className="p-3 rounded-2xl text-center"
           style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          <MessageCircle size={19} className="mx-auto mb-2" color="#25D366" />
           <span className="block text-[11px] text-slate-800 font-semibold">WhatsApp</span>
        </a>
      </section>

       <div className="p-4 rounded-xl mb-6 bg-white border border-slate-200 shadow-sm">
         <p className="text-xs font-semibold text-slate-800 mb-1">{isAr ? 'ساعات الدعم' : 'Horaires du support'}</p>
         <p className="text-xs text-slate-500">{support.hours}</p>
         <p className="text-[10px] mt-2 break-all text-slate-400">
          {support.phone} · {support.email}
        </p>
      </div>

      <section>
         <h2 className="text-indigo-600 font-extrabold text-sm mb-3">{isAr ? 'الأسئلة الشائعة' : 'Questions fréquentes'}</h2>
        <div className="space-y-2">
          {faq.map(([question, answer], index) => (
             <div key={question} className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
              <button onClick={() => setOpen(open === index ? -1 : index)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left">
                 <span className="text-slate-800 text-xs font-semibold">{question}</span>
                <ChevronDown size={15} color="rgba(255,255,255,0.45)"
                  style={{ transform: open === index ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {open === index && (
                 <p className="px-4 pb-4 text-xs leading-6 text-slate-500">{answer}</p>
              )}
            </div>
          ))}
        </div>
      </section>
      <ClientNav />
    </div>
  )
}