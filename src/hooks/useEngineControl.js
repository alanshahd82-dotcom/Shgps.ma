import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

// Single source of truth for the engine relay control. The vehicle detail
// page button is the reference behaviour; every other place must use this hook
// so the availability rules, the relay command and the feedback messages are
// identical everywhere.
//
// Phase 1: the CUT/RESUME button state is derived from the authoritative
// engine_commands row (GET /:id/active-command), NOT from vehicle.engineOn
// or ignition telemetry. Telemetry remains a separate concern — it never
// clears or sets command state. The hook fetches the active command on
// initial load, on vehicle identity change, and after WebSocket reconnect.

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

// Phase 1: derive the button state from the authoritative command, not from
// ignition telemetry.
export function isCutActive(command) {
  if (!command) return false
  const isActive = ['unconfirmed', 'delivered'].includes(command.status)
  return command.requested_state === 'stopped' && isActive
}

export function isCutPending(command) {
  if (!command) return false
  const inFlight = ['requested', 'pending', 'sent'].includes(command.status)
  return command.requested_state === 'stopped' && inFlight
}

export function isResumePending(command) {
  if (!command) return false
  const inFlight = ['requested', 'pending', 'sent'].includes(command.status)
  return command.requested_state === 'running' && inFlight
}

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
  return ar ? 'توجد أمر محرك نشط ومتعارض لهذه المركبة' : fr ? 'Une commande moteur active et conflictuelle existe pour ce véhicule' : 'A conflicting engine command is already active for this vehicle'
}

function reconciliationMessage(lang) {
  const ar = lang === 'ar'
  const fr = lang === 'fr'
  return ar ? 'جارٍ إلغاء أمر سابق في النظام؛ سيُرسل أمرك الجديد عند تأكيد الإلغاء' : fr ? "Annulation d'une commande précédente en cours ; la nouvelle commande sera envoyée après confirmation" : 'Cancelling a previous queued command; your new command will be sent once cancellation is confirmed'
}

export function useEngineControl(vehicle, lang = 'ar') {
  const { refreshDevices, wsConnected } = useApp()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeCommand, setActiveCommand] = useState(null)
  const [commandLoading, setCommandLoading] = useState(false)
  const mounted = useRef(true)
  const fetchIdRef = useRef(0)
  const hasFetchedRef = useRef(false)   // FIX A/C: tracks first successful fetch
  const hasSentRef = useRef(false)       // FIX B: gates success message to send() only

  useEffect(() => () => { mounted.current = false }, [])

  // Phase 1: fetch the authoritative command state from the backend. This is
  // the ONLY source for the CUT/RESUME button — never vehicle.engineOn.
  const fetchActiveCommand = useCallback(async () => {
    if (!vehicle?.id) return
    const fetchId = ++fetchIdRef.current
    setCommandLoading(true)
    try {
      const response = await api.devices.getActiveCommand(vehicle.id)
      if (mounted.current && fetchId === fetchIdRef.current) {
        setActiveCommand(response?.command ?? null)
        hasFetchedRef.current = true
      }
    } catch {
      // FIX A: API failure must NOT erase a previously known authoritative
      // command state. Preserve the existing activeCommand — never silently
      // revert to NORMAL. If this was the initial fetch (hasFetchedRef still
      // false), activeCommand stays null and canControl stays false (Fix C).
      if (mounted.current && fetchId === fetchIdRef.current) {
        // Do NOT setActiveCommand(null) — keep the last known state.
      }
    } finally {
      if (mounted.current && fetchId === fetchIdRef.current) {
        setCommandLoading(false)
      }
    }
  }, [vehicle?.id])

  // Fetch on initial load and when vehicle identity changes.
  useEffect(() => {
    setActiveCommand(null)
    setError('')
    setSuccess('')
    hasFetchedRef.current = false
    hasSentRef.current = false
    fetchActiveCommand()
  }, [vehicle?.id, fetchActiveCommand])

  // Re-fetch after WebSocket reconnect (wsConnected transitions false->true).
  const prevWsConnectedRef = useRef(false)
  useEffect(() => {
    if (wsConnected && !prevWsConnectedRef.current) {
      fetchActiveCommand()
    }
    prevWsConnectedRef.current = wsConnected
  }, [wsConnected, fetchActiveCommand])

  // Phase 1: derive engineRunning from the authoritative command, not from
  // ignition telemetry. Command state has priority for the CUT control UI.
  const engineRunning = (() => {
    if (!activeCommand) return true
    const isActive = ['unconfirmed', 'delivered'].includes(activeCommand.status)
    const inFlight = ['requested', 'pending', 'sent'].includes(activeCommand.status)
    if (activeCommand.requested_state === 'stopped' && isActive) return false
    if (activeCommand.requested_state === 'running' && inFlight) return false
    return true
  })()

  // FIX C: commandReady is false until the first successful fetch completes.
  // During initial loading or after an initial-load failure, the command
  // state is unknown — the CUT/RESUME control must not be actionable.
  // Once hasFetchedRef is true (backend confirmed state, even if null) or
  // activeCommand is non-null, the control is actionable (subject to reach).
  const commandReady = hasFetchedRef.current || activeCommand !== null
  const canControl = commandReady && isVehicleReachable(vehicle)

  // Phase 1: derive the UI feedback message from the authoritative command.
  // FIX B: only derive the success message from activeCommand after the
  // user has explicitly sent a command. Initial load, vehicle change, and WS
  // reconnect must NOT show a success toast.
  useEffect(() => {
    if (!hasSentRef.current) return
    if (!activeCommand) return
    if (isCutPending(activeCommand)) {
      setSuccess(statusMessage(activeCommand.status, lang))
    } else if (isCutActive(activeCommand)) {
      setSuccess(statusMessage('unconfirmed', lang))
    } else if (isResumePending(activeCommand)) {
      setSuccess(statusMessage(activeCommand.status, lang))
    }
  }, [activeCommand, lang])

  const send = useCallback(async (turnOff) => {
    if (!vehicle?.id || sending) return false
    setSending(true); setError(''); setSuccess('')
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random())
    try {
      const response = await api.devices.sendCommand(vehicle.id, turnOff ? 'engineStop' : 'engineResume', { 'Idempotency-Key': idempotencyKey })
      const status = response?.command?.status || response?.status
      const gateHeld = !!response?.command?.gateHeld || !!response?.gateHeld
      if (mounted.current) {
        if (gateHeld) {
          setSuccess(reconciliationMessage(lang))
        } else if (status) {
          setSuccess(statusMessage(status, lang))
        } else {
          setError(t(lang, 'engineCommandUnknown'))
        }
      }
      // FIX B: mark that the user explicitly sent a command, so the
      // activeCommand effect may show a success message after the refetch.
      hasSentRef.current = true
      // Phase 1: re-fetch the authoritative command state after sending.
      try { await fetchActiveCommand() } catch {}
      try { await refreshDevices?.() } catch {}
      return true
    } catch (e) {
      if (mounted.current) {
        setError(t(lang, 'vehicleCommandFailed'))
      }
      return false
    } finally {
      if (mounted.current) setSending(false)
    }
  }, [lang, refreshDevices, sending, vehicle?.id, fetchActiveCommand])

  const clearFeedback = useCallback(() => { setError(''); setSuccess('') }, [])

  return { engineRunning, canControl, sending, error, success, send, clearFeedback, activeCommand, commandLoading }
}

export default useEngineControl
