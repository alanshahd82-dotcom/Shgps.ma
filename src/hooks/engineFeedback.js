// Pure functions for engine command feedback resolution.
// Separated from useEngineControl.js to allow unit testing without React.
//
// Phase 2A: unconfirmed status is routed to a caution channel, NOT success.
// GT06 hardware cannot confirm physical relay state (ENG-CONSTRAINT-001),
// so the UI must never claim physical execution when the backend reports
// unconfirmed. In-flight statuses (pending, requested, sent) are also
// caution — they are not successful completion.

export function statusMessage(status, lang) {
  const ar = lang === 'ar'
  const fr = lang === 'fr'
  switch (status) {
    case 'pending':
      return ar ? 'بانتظار اتصال المركبة' : fr ? 'En attente de connexion du véhicule' : 'Waiting for vehicle connection'
    case 'sent':
      return ar ? 'تم إرسال الأمر إلى الجهاز' : fr ? 'Commande envoyée au périphérique' : 'Command sent to device'
    case 'delivered':
      return ar ? 'تم تسليم الأمر إلى الجهاز' : fr ? 'Commande livrée au périphérique' : 'Command delivered to device'
    case 'unconfirmed':
      return ar ? 'استلم الجهاز الأمر؛ لا يمكن تأكيد حالة المحرك الفعلية' : fr ? "Le périphérique a reçu la commande ; l'état physique du moteur ne peut être confirmé" : 'Device received the command; physical engine state cannot be confirmed'
    case 'failed':
      return ar ? 'فشل إرسال الأمر' : fr ? "Échec de l'envoi de la commande" : 'Command failed to send'
    case 'cancelled':
      return ar ? 'تم إلغاء الأمر' : fr ? 'Commande annulée' : 'Command cancelled'
    default:
      return ''
  }
}

export function reconciliationMessage(lang) {
  const ar = lang === 'ar'
  const fr = lang === 'fr'
  return ar ? 'جارٍ إلغاء أمر سابق في النظام؛ سيُرسل أمرك الجديد عند تأكيد الإلغاء' : fr ? "Annulation d'une commande précédente en cours ; la nouvelle commande sera envoyée après confirmation" : 'Cancelling a previous queued command; your new command will be sent once cancellation is confirmed'
}

// Maps a command status to the appropriate UI feedback channel.
// Returns: success | caution | unknown
//
// - delivered -> success (confirmed delivery — the only true success)
// - unconfirmed -> caution (device received, physical state unknown)
// - pending, requested, sent -> caution (in-flight, not complete)
// - failed, cancelled -> success (preserved existing behavior)
// - unknown/non-empty -> success (preserved existing behavior)
// - empty/null/undefined -> unknown (triggers error fallback)
export function resolveFeedbackChannel(status) {
  if (!status) return 'unknown'
  if (status === 'unconfirmed') return 'caution'
  if (['pending', 'requested', 'sent'].includes(status)) return 'caution'
  return 'success'
}
