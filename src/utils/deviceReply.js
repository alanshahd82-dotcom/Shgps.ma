// Turns the tracker's own answer to an engine command (backend `deviceReply`)
// into a short message in the user's language. Pure and React-free.
// Returns { tone: 'ok' | 'wait' | 'warn', text } or null when there is no answer.
const TEXT = {
  cut_success: { ar: 'أكّد الجهاز: تم قطع المحرك', fr: "L'appareil confirme : moteur coupé", en: 'Device confirmed: engine cut off' },
  resume_success: { ar: 'أكّد الجهاز: تمت إعادة تشغيل المحرك', fr: "L'appareil confirme : moteur rétabli", en: 'Device confirmed: engine restored' },
  delayed: { ar: 'الجهاز لا يلتقط إشارة GPS، فأجّل التنفيذ. سيُنفَّذ الأمر عندما يلتقط الإشارة.', fr: "L'appareil n'a pas de signal GPS et a reporté l'exécution. Elle aura lieu dès que le signal reviendra.", en: 'The device has no GPS fix and postponed the command. It will run once it gets a signal.' },
  already: { ar: 'المحرك كان في الحالة المطلوبة أصلاً.', fr: 'Le moteur était déjà dans l’état demandé.', en: 'The engine was already in the requested state.' },
  failed: { ar: 'رفض الجهاز الأمر.', fr: "L'appareil a refusé la commande.", en: 'The device rejected the command.' },
  unknown: { ar: 'ردّ الجهاز', fr: "Réponse de l'appareil", en: 'Device reply' },
}

const pick = (entry, lang) => entry[lang] || entry.en

export function describeDeviceReply(reply, lang = 'ar') {
  if (!reply || !reply.outcome) return null
  switch (reply.outcome) {
    case 'success':
      return { tone: 'ok', text: pick(reply.kind === 'resume' ? TEXT.resume_success : TEXT.cut_success, lang) }
    case 'delayed_no_gps':
      return { tone: 'wait', text: pick(TEXT.delayed, lang) }
    case 'already':
      return { tone: 'ok', text: pick(TEXT.already, lang) }
    case 'failed':
      return { tone: 'warn', text: pick(TEXT.failed, lang) }
    default:
      return reply.text ? { tone: 'wait', text: `${pick(TEXT.unknown, lang)}: ${reply.text}` } : null
  }
}
