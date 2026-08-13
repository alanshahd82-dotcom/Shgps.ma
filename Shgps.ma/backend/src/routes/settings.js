import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { db } from '../db.js'
import {
  getRenewalContacts,
  getSupportSettings,
  saveRenewalContacts,
  saveSupportSettings,
} from '../services/supportSettings.js'

export const settingsRouter = Router()

// Public support contacts are intentionally available to the help screen.
settingsRouter.get('/support', async (_req, res) => {
  try {
    res.json(await getSupportSettings(db))
  } catch (err) {
    console.error('[settings/support]', err)
    res.status(500).json({ error: 'Unable to load support contacts' })
  }
})

settingsRouter.put('/support', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await saveSupportSettings(db, req.body || {}))
  } catch (err) {
    const status = err.code?.startsWith('INVALID_') ? 400 : 500
    console.error('[settings/support update]', err)
    res.status(status).json({ error: err.message || 'Unable to save support contacts' })
  }
})

// Renewal contacts are public because authenticated clients use them to start a request.
settingsRouter.get('/renewal-contacts', async (_req, res) => {
  try {
    res.json(await getRenewalContacts(db))
  } catch (err) {
    console.error('[settings/renewal-contacts]', err)
    res.status(500).json({ error: 'Unable to load renewal contacts' })
  }
})

settingsRouter.put('/renewal-contacts', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await saveRenewalContacts(db, req.body || {}))
  } catch (err) {
    const status = err.code?.startsWith('INVALID_') ? 400 : 500
    console.error('[settings/renewal-contacts update]', err)
    res.status(status).json({ error: err.message || 'Unable to save renewal contacts' })
  }
})