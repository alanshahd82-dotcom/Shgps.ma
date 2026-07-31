import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, FileText } from 'lucide-react'

const content = {
  ar: {
    title: 'الشروط والأحكام',
    subtitle: 'يرجى قراءة هذه الشروط بعناية قبل استخدام خدمة AtharGPS',
    updated: 'آخر تحديث: يناير 2025',
    sections: [
      {
        h: '1. قبول الشروط',
        p: 'باستخدامك لمنصة AtharGPS وخدماتها، فإنك توافق على الالتزام بجميع الشروط والأحكام الواردة في هذه الاتفاقية. إذا كنت لا توافق على هذه الشروط، فيُرجى عدم استخدام الخدمة.',
      },
      {
        h: '2. وصف الخدمة',
        p: 'تقدّم AtharGPS نظاماً لتتبع المركبات بالوقت الفعلي باستخدام تقنية GPS، وتشمل الخدمة: المراقبة المباشرة، التقارير التفصيلية، التنبيهات الذكية، إيقاف المحرك عن بُعد، وإدارة السياج الجغرافي.',
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
        p: 'لا تتحمل AtharGPS المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناجمة عن استخدام الخدمة أو عدم توفرها مؤقتاً، بما في ذلك الأعطال التقنية أو انقطاع الإنترنت.',
      },
      {
        h: '7. تعديل الشروط',
        p: 'تحتفظ AtharGPS بحق تعديل هذه الشروط في أي وقت. سيتم إعلامك بأي تغييرات جوهرية عبر البريد الإلكتروني المسجّل. استمرارك في استخدام الخدمة بعد التعديل يُعتبر قبولاً للشروط الجديدة.',
      },
      {
        h: '8. إنهاء الخدمة',
        p: 'يحق لـ AtharGPS تعليق أو إنهاء حسابك في حالة انتهاك هذه الشروط أو عدم الدفع في الوقت المحدد، مع إشعار مسبق يوضح الأسباب.',
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
  fr: {
    title: 'Conditions Générales d\'Utilisation',
    subtitle: 'Veuillez lire attentivement ces conditions avant d\'utiliser AtharGPS',
    updated: 'Dernière mise à jour : Janvier 2025',
    sections: [
      {
        h: '1. Acceptation des Conditions',
        p: 'En utilisant la plateforme AtharGPS et ses services, vous acceptez d\'être lié par l\'ensemble des conditions énoncées dans ce contrat. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser le service.',
      },
      {
        h: '2. Description du Service',
        p: 'AtharGPS fournit un système de suivi de véhicules en temps réel par technologie GPS, incluant : surveillance en direct, rapports détaillés, alertes intelligentes, coupure du moteur à distance, et gestion des zones géographiques.',
      },
      {
        h: '3. Compte et Responsabilités',
        p: 'Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toutes les activités effectuées via votre compte. Tout accès non autorisé doit être signalé immédiatement.',
      },
      {
        h: '4. Utilisation Acceptable',
        p: 'Il est interdit d\'utiliser le service à des fins illégales ou pour surveiller des personnes sans leur consentement. Vous devez respecter toutes les lois applicables au Royaume du Maroc.',
      },
      {
        h: '5. Confidentialité et Données de Localisation',
        p: 'Les données de localisation de vos véhicules sont traitées de manière strictement confidentielle et ne sont pas partagées avec des tiers sans votre consentement explicite ou en vertu d\'une ordonnance judiciaire.',
      },
      {
        h: '6. Limitation de Responsabilité',
        p: 'AtharGPS ne peut être tenu responsable de tout dommage direct ou indirect résultant de l\'utilisation ou de l\'indisponibilité du service, y compris les pannes techniques ou les interruptions d\'internet.',
      },
      {
        h: '7. Modification des Conditions',
        p: 'AtharGPS se réserve le droit de modifier ces conditions à tout moment. Toute modification substantielle vous sera notifiée par e-mail. Votre utilisation continue du service après modification vaut acceptation des nouvelles conditions.',
      },
      {
        h: '8. Résiliation',
        p: 'AtharGPS peut suspendre ou résilier votre compte en cas de violation des présentes conditions ou de non-paiement, avec un préavis précisant les motifs.',
      },
      {
        h: '9. Loi Applicable',
        p: 'Le présent contrat est régi par les lois du Royaume du Maroc. Les tribunaux marocains sont compétents pour tout litige en découlant.',
      },
      {
        h: '10. Contact',
        p: 'Pour toute question sur ces conditions : support@athargps.ma',
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
