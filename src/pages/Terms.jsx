import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, FileText } from 'lucide-react'

const content = {
  ar: {
    title: 'الشروط والأحكام',
    subtitle: 'يرجى قراءة هذه الشروط بعناية قبل استخدام خدمة ATHAR GPS',
    updated: 'آخر تحديث: يناير 2025',
    sections: [
      {
        h: '1. قبول الشروط',
        p: 'باستخدامك لمنصة ATHAR GPS وخدماتها، فإنك توافق على الالتزام بجميع الشروط والأحكام الواردة في هذه الاتفاقية. إذا كنت لا توافق على هذه الشروط، فيُرجى عدم استخدام الخدمة.',
      },
      {
        h: '2. وصف الخدمة',
        p: 'تقدّم ATHAR GPS نظاماً لتتبع المركبات بالوقت الفعلي باستخدام تقنية GPS، وتشمل الخدمة: المراقبة المباشرة، التقارير التفصيلية، التنبيهات الذكية، إيقاف المحرك عن بُعد، وإدارة السياج الجغرافي.',
      },
      {
        h: '3. الحساب والمسؤوليات',
        p: 'أنت مسؤول عن الحفاظ على سرية معلومات تسجيل دخولك وعن جميع الأنشطة التي تتم عبر حسابك. يجب الإبلاغ فوراً عن أي استخدام غير مصرح به.',
      },
      {
        h: '4. الاستخدام المقبول',
        p: 'يُحظر استخدام الخدمة لأغراض غير قانونية أو لمراقبة الأفراد دون موافقتهم أو لأي غرض يضرّ بالآخرين. يجب الالتزام بجميع القوانين المعمول بها في المملكة المغربية.',
      },
      {
        h: '5. الخصوصية وبيانات الموقع',
        p: 'تُعامَل بيانات الموقع الجغرافي لمركباتك بسرية تامة ولا تُشارَك مع أطراف ثالثة إلا بموافقتك الصريحة أو بموجب أمر قضائي. راجع سياسة الخصوصية للمزيد.',
      },
      {
        h: '6. حدود المسؤولية',
        p: 'لا تتحمل ATHAR GPS المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناجمة عن استخدام الخدمة أو عدم توفرها مؤقتاً، بما في ذلك الأعطال التقنية أو انقطاع الإنترنت.',
      },
      {
        h: '7. تعديل الشروط',
        p: 'تحتفظ ATHAR GPS بحق تعديل هذه الشروط في أي وقت. سيتم إعلامك بأي تغييرات جوهرية عبر البريد الإلكتروني المسجّل. استمرارك في استخدام الخدمة بعد التعديل يُعتبر قبولاً للشروط الجديدة.',
      },
      {
        h: '8. إنهاء الخدمة',
        p: 'يحق لـ ATHAR GPS تعليق أو إنهاء حسابك في حالة انتهاك هذه الشروط أو عدم الدفع في الوقت المحدد، مع إشعار مسبق يوضح الأسباب.',
      },
      {
        h: '9. القانون الحاكم',
        p: 'تخضع هذه الاتفاقية لقوانين المملكة المغربية، وتكون محاكم المغرب مختصة بالفصل في أي نزاع ينشأ عنها.',
      },
      {
        h: '10. التواصل',
        p: 'لأي استفسارات حول هذه الشروط، يُرجى التواصل عبر: support@athargps.ma',
      },
    ],
  },
  en: {
    title: 'Terms & Conditions',
    subtitle: 'Please read these terms carefully before using ATHAR GPS',
    updated: 'Last updated: January 2025',
    sections: [
      {
        h: '1. Acceptance of Terms',
        p: 'By using the ATHAR GPS platform and its services, you agree to be bound by all the terms and conditions set out in this agreement. If you do not agree to these terms, please do not use the service.',
      },
      {
        h: '2. Service Description',
        p: 'ATHAR GPS provides a real-time vehicle tracking system using GPS technology, including: live monitoring, detailed reports, smart alerts, remote engine cut-off, and geofence management.',
      },
      {
        h: '3. Account & Responsibilities',
        p: 'You are responsible for maintaining the confidentiality of your login credentials and for all activities carried out through your account. Any unauthorised use must be reported immediately.',
      },
      {
        h: '4. Acceptable Use',
        p: 'You may not use the service for illegal purposes or to monitor individuals without their consent. You must comply with all laws applicable in the Kingdom of Morocco.',
      },
      {
        h: '5. Privacy & Location Data',
        p: 'Your vehicles\' location data is treated with strict confidentiality and is not shared with third parties without your explicit consent or a court order. Please refer to our Privacy Policy for more details.',
      },
      {
        h: '6. Limitation of Liability',
        p: 'ATHAR GPS is not liable for any direct or indirect damages arising from the use or temporary unavailability of the service, including technical failures or internet outages.',
      },
      {
        h: '7. Modification of Terms',
        p: 'ATHAR GPS reserves the right to modify these terms at any time. You will be notified of any substantial changes via your registered email. Continued use of the service after modification constitutes acceptance of the new terms.',
      },
      {
        h: '8. Termination',
        p: 'ATHAR GPS may suspend or terminate your account in the event of a breach of these terms or non-payment, with prior notice stating the reasons.',
      },
      {
        h: '9. Governing Law',
        p: 'This agreement is governed by the laws of the Kingdom of Morocco. Moroccan courts have jurisdiction over any dispute arising from it.',
      },
      {
        h: '10. Contact',
        p: 'For any questions about these terms: support@athargps.ma',
      },
    ],
  },
}

export default function Terms() {
  const navigate = useNavigate()
  const [lang, setLang] = React.useState('ar')
  const c = content[lang]

  return (
    <div className="min-h-screen" style={{ background: '#0a1628' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(160deg,#0F2044 0%,#162d5e 100%)' }}>
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <h1 className="text-white text-base font-bold truncate">{c.title}</h1>
          </div>
          <p className="text-blue-200/50 text-[10px]">{c.updated}</p>
        </div>
        <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
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
