// Alert messages are stored bilingually by the backend as
// "النص العربي / Texte français". The UI must only show the half that matches
// the language the user selected, never both at once.
export function localizeAlertMessage(message, lang = 'ar') {
  if (!message || typeof message !== 'string') return message || ''
  const parts = message.split(' / ')
  if (parts.length !== 2) return message
  const [arabic, french] = parts.map(part => part.trim())
  if (!arabic || !french) return message
  return lang === 'fr' ? french : arabic
}

export default localizeAlertMessage
