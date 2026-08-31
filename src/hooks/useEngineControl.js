import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

// Single source of truth for the engine relay control. The vehicle detail
// page button is the reference behaviour; every other place must use this hook
// so the availability rules, the relay command and the feedback messages are
// identical everywhere.
//
// Phase 2B: the backend persists every command before delivery and returns a
// truthful command state. We never claim the engine physically stopped — only
// what the evidence supports (pending / sent / unconfirmed).

const ONLINE_WINDOW_MS = 15 * 60 * 1000

export function isVehicleReachable(vehicle) {
  if (!vehicle) return false
  const lastUp = vehicle.lastUpdate ?? vehicle.fixTime ?? vehicle.last_update
  const fresh = lastUp ? (Date.now() - new Date(lastUp).getTime()) < ONLINE_WINDOW_MS : false
  return fresh || vehicle.status === 'online'
}

export function isEngineRunning(vehicle) {
  const raw = vehicle?.engineOn ?? vehicle?.ignition
  return raw !== false
}

// Truthful status wording. GT06 cannot confirm the physical relay state, so
// 'unconfirmed' is the strongest claim we make after delivery. We never show
// "Engine stopped".
function statusMessage(status, lang) {
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

function conflictMessage(lang) {
  const ar = lang === 'ar'
  const fr = lang === 'fr'
  return ar ? 'يوجد أمر محرك نشط ومتعارض لهذه المركبة' : fr ? 'Une commande moteur active et conflictuelle existe pour ce véhicule' : 'A conflicting engine command is already active for this vehicle'
}

export function useEngineControl(vehicle, lang = 'ar') {
  const { refreshDevices } = useApp()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [engineState, setEngineState] = useState(null)
  const mounted = useRef(true)

  useEffect(() => () => { mounted.current = false }, [])
  useEffect(() => { setEngineState(null); setError(''); setSuccess('') }, [vehicle?.id])

  const engineRunning = engineState != null ? engineState : isEngineRunning(vehicle)
  const canControl = isVehicleReachable(vehicle)

  const send = useCallback(async (turnOff) => {
    if (!vehicle?.id || sending) return false
    setSending(true); setError(''); setSuccess('')
    // Idempotency-Key: the backend is the final authority. A fresh key per
    // logical request; the backend conflict check prevents duplicate physical
    // commands across tabs / reloads even with different keys.
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random())
    try {
      const response = await api.devices.sendCommand(vehicle.id, turnOff ? 'engineStop' : 'engineResume', { 'Idempotency-Key': idempotencyKey })
      const status = response?.command?.status || response?.status
      if (mounted.current) {
        if (status) {
          setSuccess(statusMessage(status, lang))
        } else {
          // P0-1: no authoritative command.status must NEVER read as success.
          // Unknown / malformed response -> explicit unknown/error state.
          setError(t(lang, 'engineCommandUnknown'))
        }
      }
      // Read the actual state after the command instead of inferring it.
      try {
        const refreshed = await api.devices.get(vehicle.id)
        if (mounted.current && typeof refreshed?.engineOn === 'boolean') setEngineState(refreshed.engineOn)
      } catch {}
      try { await refreshDevices?.() } catch {}
      return true
    } catch (e) {
      if (mounted.current) {
        if (e?.status === 409) setError(conflictMessage(lang))
        else setError(t(lang, 'vehicleCommandFailed'))
      }
      return false
    } finally {
      if (mounted.current) setSending(false)
    }
  }, [lang, refreshDevices, sending, vehicle?.id])

  const clearFeedback = useCallback(() => { setError(''); setSuccess('') }, [])

  return { engineRunning, canControl, sending, error, success, send, clearFeedback }
}

export default useEngineControl
