export const DEFAULT_SUPPORT_SETTINGS = Object.freeze({
  email: 'support@athargps.ma',
  phone: '+212600000000',
  whatsapp: '212600000000',
  hours: 'كل يوم من 09:00 إلى 18:00',
  googlePlayUrl: '',
  appStoreUrl: '',
  renew_whatsapp_phone: '+212600000000',
  renew_email: 'support@athargps.com',
})

const RENEWAL_KEYS = ['renew_whatsapp_phone', 'renew_email']

export async function getSupportSettings(db) {
  const { rows } = await db.query(
    `SELECT value FROM app_settings WHERE key='support_contacts' LIMIT 1`
  )
  if (!rows[0]?.value) return { ...DEFAULT_SUPPORT_SETTINGS }

  try {
    return { ...DEFAULT_SUPPORT_SETTINGS, ...JSON.parse(rows[0].value) }
  } catch {
    return { ...DEFAULT_SUPPORT_SETTINGS }
  }
}

export async function saveSupportSettings(db, input) {
  const current = await getSupportSettings(db)
  const next = {
    email: String(input.email ?? current.email).trim().toLowerCase(),
    phone: String(input.phone ?? current.phone).trim(),
    whatsapp: String(input.whatsapp ?? current.whatsapp).replace(/[^\d+]/g, ''),
    hours: String(input.hours ?? current.hours).trim(),
    googlePlayUrl: String(input.googlePlayUrl ?? current.googlePlayUrl ?? '').trim(),
    appStoreUrl: String(input.appStoreUrl ?? current.appStoreUrl ?? '').trim(),
    renew_whatsapp_phone: String(input.renew_whatsapp_phone ?? current.renew_whatsapp_phone ?? '').trim(),
    renew_email: String(input.renew_email ?? current.renew_email ?? '').trim().toLowerCase(),
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) {
    const error = new Error('A valid support email is required')
    error.code = 'INVALID_SUPPORT_EMAIL'
    throw error
  }
  if (!/^\+?[0-9\s().-]{8,24}$/.test(next.phone)) {
    const error = new Error('A valid support phone is required')
    error.code = 'INVALID_SUPPORT_PHONE'
    throw error
  }
  if (!/^\+?[0-9]{8,20}$/.test(next.whatsapp)) {
    const error = new Error('A valid WhatsApp number is required')
    error.code = 'INVALID_SUPPORT_WHATSAPP'
    throw error
  }
  if (!next.hours || next.hours.length > 120) {
    const error = new Error('Support hours are required')
    error.code = 'INVALID_SUPPORT_HOURS'
    throw error
  }
  for (const [key, value] of [['googlePlayUrl', next.googlePlayUrl], ['appStoreUrl', next.appStoreUrl]]) {
    if (value && !/^https?:\/\/\S+$/i.test(value)) {
      const error = new Error(`${key} must be a valid store URL`)
      error.code = 'INVALID_STORE_URL'
      throw error
    }
  }

  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('support_contacts', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [JSON.stringify(next)]
  )
  return next
}

export async function getRenewalContacts(db) {
  const settings = await getSupportSettings(db)
  return Object.fromEntries(RENEWAL_KEYS.map(key => [key, settings[key] || '']))
}

export async function saveRenewalContacts(db, input) {
  const current = await getSupportSettings(db)
  const next = {
    ...current,
    renew_whatsapp_phone: String(input.renew_whatsapp_phone ?? '').trim(),
    renew_email: String(input.renew_email ?? '').trim().toLowerCase(),
  }

  if (next.renew_whatsapp_phone && !/^\+?[0-9\s().-]{8,24}$/.test(next.renew_whatsapp_phone)) {
    const error = new Error('A valid renewal WhatsApp number is required')
    error.code = 'INVALID_RENEW_WHATSAPP'
    throw error
  }
  if (next.renew_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.renew_email)) {
    const error = new Error('A valid renewal email is required')
    error.code = 'INVALID_RENEW_EMAIL'
    throw error
  }

  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('support_contacts', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [JSON.stringify(next)]
  )
  return getRenewalContacts(db)
}