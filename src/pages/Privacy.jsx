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
  en: {
    title: 'Privacy Policy',
    subtitle: 'We are committed to protecting your personal data and your vehicles\' location data',
    updated: 'Last updated: January 2025',
    sections: [
      {
        h: '1. Information We Collect',
        p: 'We collect: (a) Account data: name, email, phone number, (b) Real-time and historical GPS location data for your vehicles, (c) Device data: IMEI, plate number, vehicle type, (d) Usage data: login logs and operations.',
      },
      {
        h: '2. How We Use Your Data',
        p: 'Your data is used to: provide the tracking and monitoring service, send alerts and notifications, generate reports, improve the service, and comply with legal requirements. We do not use your data for other commercial purposes without your consent.',
      },
      {
        h: '3. Location Data',
        p: 'Your vehicles\' location data is sensitive and handled with the utmost care. It is stored securely on our servers in Morocco and remains your property. Location history is retained for 90 days and then automatically deleted.',
      },
      {
        h: '4. Data Sharing',
        p: 'We do not sell, rent, or trade your personal data with third parties. We may share data with trusted technical service providers (under strict confidentiality agreements) or when required by law.',
      },
      {
        h: '5. Data Security',
        p: 'We use SSL/TLS encryption for all communications, encryption of sensitive data in databases, advanced firewalls, and continuous security monitoring. However, no digital system can guarantee absolute security.',
      },
      {
        h: '6. Your Rights',
        p: 'You have the right to access, correct, delete, object to the processing of, and request portability of your data. To exercise these rights, contact us at: privacy@athargps.ma',
      },
      {
        h: '7. Cookies',
        p: 'We only use cookies necessary to maintain your login session and preferences. We do not use advertising tracking cookies.',
      },
      {
        h: '8. Data Retention',
        p: 'Account data is retained for the duration of the active subscription. Upon cancellation, personal data is deleted within 30 days, location data within 90 days, and billing records are kept for 5 years in accordance with Moroccan law.',
      },
      {
        h: '9. Policy Updates',
        p: 'We reserve the right to update this policy. You will be notified of any substantial changes by email 30 days before they take effect.',
      },
      {
        h: '10. Contact',
        p: 'For any privacy questions: privacy@athargps.ma | Tel: +212 600 000 000',
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
        <button onClick={() => navigate(-1)} aria-label="رجوع / Retour" className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <h1 className="text-white text-base font-bold truncate">{c.title}</h1>
          </div>
          <p className="text-blue-200/50 text-[10px]">{c.updated}</p>
        </div>
        <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
          aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          className="text-xs bg-white/10 text-white/70 px-3 py-1.5 rounded-lg font-medium">
          {lang === 'ar' ? 'EN' : 'AR'}
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
