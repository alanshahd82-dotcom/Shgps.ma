import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Shield } from 'lucide-react'

const content = {
  ar: {
    title: 'سياسة الخصوصية',
    subtitle: 'نحن ملتزمون بحماية بياناتك الشخصية وبيانات موقع مركباتك',
    updated: 'آخر تحديث: يناير 2025',
    sections: [
      {
        h: '1. المعلومات التي نجمعها',
        p: 'نجمع المعلومات التالية: (أ) بيانات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف، (ب) بيانات الموقع الجغرافي للمركبات بالوقت الفعلي والتاريخية، (ج) بيانات الجهاز: IMEI، رقم اللوحة، نوع المركبة، (د) بيانات الاستخدام: سجلات تسجيل الدخول والعمليات.',
      },
      {
        h: '2. كيف نستخدم بياناتك',
        p: 'نستخدم بياناتك لـ: تقديم خدمة التتبع والمراقبة، إرسال التنبيهات والإشعارات، إنشاء التقارير، تحسين الخدمة، والامتثال للمتطلبات القانونية. لا نستخدم بياناتك لأغراض تجارية أخرى دون موافقتك.',
      },
      {
        h: '3. بيانات الموقع الجغرافي',
        p: 'بيانات الموقع الجغرافي لمركباتك حساسة ونتعامل معها بعناية فائقة. تُخزَّن هذه البيانات بشكل آمن على خوادمنا في المغرب وتبقى ملكاً لك. نحتفظ بسجلات المواقع لمدة 90 يوماً ثم تُحذف تلقائياً.',
      },
      {
        h: '4. مشاركة البيانات',
        p: 'لا نبيع ولا نؤجر ولا نتاجر ببياناتك الشخصية مع أطراف ثالثة. قد نشارك البيانات مع: مزودي الخدمات التقنية الموثوقين الذين يساعدوننا في تشغيل المنصة (وفق اتفاقيات سرية صارمة)، أو في حالة الطلب القانوني.',
      },
      {
        h: '5. أمان البيانات',
        p: 'نستخدم تشفير SSL/TLS لجميع الاتصالات، وتشفير البيانات الحساسة في قواعد البيانات، وجدران الحماية المتقدمة، والمراقبة المستمرة للأمن. رغم ذلك، لا يمكن ضمان أمان مطلق لأي نظام رقمي.',
      },
      {
        h: '6. حقوقك',
        p: 'لديك الحق في: الاطلاع على بياناتك الشخصية، تصحيحها، حذفها، الاعتراض على معالجتها، وطلب نقلها. لممارسة هذه الحقوق، تواصل معنا عبر البريد الإلكتروني: privacy@athargps.ma',
      },
      {
        h: '7. ملفات تعريف الارتباط',
        p: 'نستخدم ملفات تعريف الارتباط الضرورية فقط للحفاظ على جلسة تسجيل دخولك وتفضيلاتك. لا نستخدم ملفات تعريف الارتباط للتتبع الإعلاني.',
      },
      {
        h: '8. الاحتفاظ بالبيانات',
        p: 'نحتفظ ببيانات حسابك طوال فترة الاشتراك النشط. عند إلغاء الاشتراك، تُحذف البيانات الشخصية خلال 30 يوماً، وبيانات الموقع خلال 90 يوماً، مع الاحتفاظ بسجلات الفواتير لمدة 5 سنوات وفق القانون المغربي.',
      },
      {
        h: '9. تحديثات السياسة',
        p: 'نحتفظ بحق تحديث هذه السياسة. سيتم إعلامك بأي تغييرات جوهرية عبر البريد الإلكتروني قبل 30 يوماً من تطبيقها.',
      },
      {
        h: '10. التواصل',
        p: 'لأي استفسارات حول الخصوصية: privacy@athargps.ma | هاتف: +212 600 000 000',
      },
    ],
  },
  fr: {
    title: 'Politique de Confidentialité',
    subtitle: 'Nous nous engageons à protéger vos données personnelles et les données de localisation de vos véhicules',
    updated: 'Dernière mise à jour : Janvier 2025',
    sections: [
      {
        h: '1. Informations Collectées',
        p: 'Nous collectons : (a) Données de compte : nom, e-mail, téléphone, (b) Données de localisation GPS des véhicules en temps réel et historiques, (c) Données d\'appareils : IMEI, plaque, type de véhicule, (d) Données d\'utilisation : journaux de connexion et opérations.',
      },
      {
        h: '2. Utilisation des Données',
        p: 'Vos données sont utilisées pour : fournir le service de suivi, envoyer des alertes, générer des rapports, améliorer le service et respecter les obligations légales. Nous n\'utilisons pas vos données à des fins commerciales sans votre consentement.',
      },
      {
        h: '3. Données de Localisation',
        p: 'Les données de localisation de vos véhicules sont sensibles et traitées avec le plus grand soin. Elles sont stockées en sécurité sur nos serveurs au Maroc et vous appartiennent. Les historiques de localisation sont conservés 90 jours puis supprimés automatiquement.',
      },
      {
        h: '4. Partage des Données',
        p: 'Nous ne vendons, louons ni échangeons pas vos données avec des tiers. Nous pouvons partager des données avec des prestataires techniques de confiance (sous accord de confidentialité strict) ou en cas de demande légale.',
      },
      {
        h: '5. Sécurité des Données',
        p: 'Nous utilisons le chiffrement SSL/TLS pour toutes les communications, le chiffrement des données sensibles en base de données, des pare-feux avancés et une surveillance continue de la sécurité.',
      },
      {
        h: '6. Vos Droits',
        p: 'Vous disposez du droit d\'accès, de rectification, de suppression, d\'opposition au traitement et de portabilité de vos données. Pour exercer ces droits : privacy@athargps.ma',
      },
      {
        h: '7. Cookies',
        p: 'Nous utilisons uniquement les cookies nécessaires au maintien de votre session et de vos préférences. Aucun cookie de suivi publicitaire n\'est utilisé.',
      },
      {
        h: '8. Conservation des Données',
        p: 'Les données de compte sont conservées pendant la durée de l\'abonnement actif. À la résiliation, les données personnelles sont supprimées sous 30 jours, les données de localisation sous 90 jours.',
      },
      {
        h: '9. Mises à Jour',
        p: 'Nous nous réservons le droit de mettre à jour cette politique. Toute modification substantielle vous sera notifiée par e-mail 30 jours avant son application.',
      },
      {
        h: '10. Contact',
        p: 'Pour toute question sur la confidentialité : privacy@athargps.ma | Tél : +212 600 000 000',
      },
    ],
  },
}

export default function Privacy() {
  const navigate = useNavigate()
  const [lang, setLang] = React.useState('ar')
  const c = content[lang]

  return (
    <div className="min-h-screen" style={{ background: '#0a1628' }}>
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <h1 className="text-white text-base font-bold truncate">{c.title}</h1>
          </div>
          <p className="text-blue-200/50 text-[10px]">{c.updated}</p>
        </div>
        <button onClick={() => setLang(l => l === 'ar' ? 'fr' : 'ar')}
          className="text-xs bg-white/10 text-white/70 px-3 py-1.5 rounded-lg font-medium">
          {lang === 'ar' ? 'FR' : 'AR'}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-16" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <p className="text-slate-400 text-sm leading-relaxed border-b border-slate-800 pb-4">{c.subtitle}</p>
        {c.sections.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <h2 className="text-white font-bold text-base mb-2">{s.h}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{s.p}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
