import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'

// Public page (no login): Google Play and the App Store require a web page that explains
// how an account and its data can be deleted. It is also linked from the app settings.
const CONTACT = 'athargpstraveler@gmail.com'
const PHONE = '+212 618 846 582'

const content = {
  ar: {
    title: 'حذف الحساب والبيانات',
    intro: 'يمكنك في أي وقت طلب حذف حسابك وبياناتك من ATHAR GPS. هذه هي الخطوات.',
    steps: [
      'أرسل رسالة إلى ' + CONTACT + ' من البريد المسجَّل في حسابك، بعنوان: "طلب حذف حساب"، واذكر اسمك ورقم هاتفك. أو راسلنا/اتصل على ' + PHONE + '.',
      'أو أخبر مدير الأسطول/الشركة التي أنشأت حسابك، فهو يستطيع حذف حسابك من لوحة الإدارة.',
      'نتحقق من هويتك (قد نتصل بك على الرقم المسجَّل) ثم ننفّذ الطلب.',
    ],
    whatH: 'ما الذي يُحذف',
    what: [
      'بيانات الحساب: الاسم والبريد الإلكتروني ورقم الهاتف وكلمة المرور، خلال 30 يوماً.',
      'بيانات مواقع المركبات وسجل الرحلات المرتبطة بحسابك، خلال 90 يوماً.',
      'الإشعارات والإعدادات المخزَّنة لحسابك.',
    ],
    keepH: 'ما الذي نحتفظ به',
    keep: 'سجلات الفواتير والاشتراكات فقط، لمدة 5 سنوات حسب القانون المغربي، دون بيانات المواقع.',
    note: 'حذف الحساب لا يوقف الاشتراك تلقائياً. أخبرنا إن أردت إلغاءه أيضاً. الحذف نهائي ولا يمكن استرجاع البيانات بعده.',
    back: 'رجوع',
  },
  fr: {
    title: 'Suppression du compte et des données',
    intro: 'Vous pouvez demander à tout moment la suppression de votre compte et de vos données ATHAR GPS. Voici comment faire.',
    steps: [
      'Écrivez à ' + CONTACT + ' depuis l’e-mail de votre compte, objet : « Demande de suppression de compte », avec votre nom et votre numéro de téléphone. Ou contactez-nous au ' + PHONE + '.',
      'Ou demandez au gestionnaire de flotte / à l’entreprise qui a créé votre compte : il peut le supprimer depuis le panneau d’administration.',
      'Nous vérifions votre identité (nous pouvons vous appeler sur le numéro enregistré) puis nous traitons la demande.',
    ],
    whatH: 'Ce qui est supprimé',
    what: [
      'Données du compte : nom, e-mail, téléphone et mot de passe, sous 30 jours.',
      'Positions des véhicules et historique des trajets liés à votre compte, sous 90 jours.',
      'Notifications et paramètres enregistrés pour votre compte.',
    ],
    keepH: 'Ce que nous conservons',
    keep: 'Uniquement les factures et abonnements, pendant 5 ans selon la loi marocaine, sans données de position.',
    note: 'La suppression du compte n’arrête pas l’abonnement automatiquement : dites-nous si vous voulez aussi le résilier. La suppression est définitive.',
    back: 'Retour',
  },
}

export default function AccountDeletion() {
  const navigate = useNavigate()
  const [lang, setLang] = React.useState(() => {
    try { return window.localStorage.getItem('athargps_lang') === 'fr' ? 'fr' : 'ar' } catch { return 'ar' }
  })
  const c = content[lang]
  return (
    <div className="min-h-screen" style={{ background: '#0a1628' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <button onClick={() => navigate(-1)} aria-label={c.back} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Trash2 size={16} className="text-accent" />
          <h1 className="truncate text-base font-bold text-white">{c.title}</h1>
        </div>
        <button onClick={() => setLang(l => (l === 'ar' ? 'fr' : 'ar'))} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70">
          {lang === 'ar' ? 'FR' : 'AR'}
        </button>
      </div>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-16" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <p className="border-b border-slate-800 pb-4 text-sm leading-relaxed text-slate-400">{c.intro}</p>
        <ol className="space-y-3">
          {c.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(lang === 'ar' ? 'طلب حذف حساب' : 'Demande de suppression de compte')}`}
          className="block rounded-xl bg-indigo-600 py-3 text-center text-sm font-bold text-white">{CONTACT}</a>
        <div>
          <h2 className="mb-2 text-base font-bold text-white">{c.whatH}</h2>
          <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed text-slate-400">{c.what.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
        <div>
          <h2 className="mb-2 text-base font-bold text-white">{c.keepH}</h2>
          <p className="text-sm leading-relaxed text-slate-400">{c.keep}</p>
        </div>
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">{c.note}</p>
      </div>
    </div>
  )
}
