import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'
import { describeDeviceReply } from '../utils/deviceReply.js'

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

// Messages for the password check (the server decides; the UI only explains).
function passwordErrorMessage(code, lang) {
  const ar = lang === 'ar'
  if (code === 'INVALID_PASSWORD') return ar ? 'كلمة السر غير صحيحة. لم يُنفَّذ أي أمر.' : 'Mot de passe incorrect. Aucune commande envoyée.'
  if (code === 'TOO_MANY_ATTEMPTS') return ar ? 'محاولات خاطئة كثيرة. انتظر بضع دقائق ثم أعد المحاولة.' : 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (code === 'PASSWORD_REQUIRED') return ar ? 'أدخل كلمة سر حسابك.' : 'Saisissez le mot de passe de votre compte.'
  return ''
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
  const [errorCode, setErrorCode] = useState(null)
  const [success, setSuccess] = useState('')
  const [activeCommand, setActiveCommand] = useState(null)
  // What the tracker itself answered (read-only, additive; never drives the button).
  const [deviceReply, setDeviceReply] = useState(null)
  const [commandLoading, setCommandLoading] = useState(false)
  const mounted = useRef(true)
  const fetchIdRef = useRef(0)
  const hasFetchedRef = useRef(false)   // FIX A/C: tracks first successful fetch
  const hasSentRef = useRef(false)       // FIX B: gates success message to send() only

  // Re-arm on mount: React StrictMode (dev) runs cleanup once before the real
  // mount, which used to leave this false and freeze the control in dev only.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

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
        setDeviceReply(response?.command ? (response?.deviceReply ?? null) : null)
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
    setDeviceReply(null)
    setError('')
    setSuccess('')
    hasFetchedRef.current = false
    hasSentRef.current = false
    fetchActiveCommand()
  }, [vehicle?.id, fetchActiveCommand])

  // After the user sends a command the tracker answers a few seconds later.
  // Look up to three more times per command (8 s, +20 s, +45 s), then stop.
  // The attempt count lives in a ref keyed by the command id, so the refetch
  // itself can never re-arm the polling; failures are ignored.
  const replyAttemptsRef = useRef({ id: null, n: 0 })
  const [replyTick, setReplyTick] = useState(0)
  const commandId = activeCommand?.id ?? null
  const commandStatus = activeCommand?.status ?? null
  useEffect(() => {
    if (!hasSentRef.current || commandId == null || deviceReply) return undefined
    if (!['sent', 'unconfirmed', 'delivered'].includes(commandStatus)) return undefined
    if (replyAttemptsRef.current.id !== commandId) replyAttemptsRef.current = { id: commandId, n: 0 }
    const delays = [8000, 20000, 45000]
    const attempt = replyAttemptsRef.current.n
    if (attempt >= delays.length) return undefined
    const timer = setTimeout(() => {
      replyAttemptsRef.current.n += 1
      Promise.resolve(fetchActiveCommand()).finally(() => { if (mounted.current) setReplyTick(t => t + 1) })
    }, delays[attempt])
    return () => clearTimeout(timer)
  }, [commandId, commandStatus, deviceReply, fetchActiveCommand, replyTick])

  // A command that is still on its way (waiting for the vehicle, or handed to the
  // tracker) changes state on the server without any event reaching this screen,
  // so keep it fresh: every 30 s, at most 40 times per command (~20 min).
  const stateWatchRef = useRef({ id: null, n: 0 })
  useEffect(() => {
    if (commandId == null || !['requested', 'pending', 'sent'].includes(commandStatus)) return undefined
    if (stateWatchRef.current.id !== commandId) stateWatchRef.current = { id: commandId, n: 0 }
    const timer = setInterval(() => {
      if (stateWatchRef.current.n >= 40) { clearInterval(timer); return }
      stateWatchRef.current.n += 1
      fetchActiveCommand()
    }, 30000)
    return () => clearInterval(timer)
  }, [commandId, commandStatus, fetchActiveCommand])

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
  // The control stays available without a signal: the backend queues the command
  // (Traccar holds it) and sends it when the tracker reconnects. `reachable` is
  // exposed so the UI can say "will run when the signal returns".
  const reachable = isVehicleReachable(vehicle)
  const canControl = commandReady

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

  const send = useCallback(async (turnOff, password) => {
    if (!vehicle?.id || sending) return false
    setSending(true); setError(''); setErrorCode(null); setSuccess('')
    const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random())
    try {
      const response = await api.devices.sendCommand(vehicle.id, turnOff ? 'engineStop' : 'engineResume', { 'Idempotency-Key': idempotencyKey }, password)
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
        setErrorCode(e?.code || null)
        setError(passwordErrorMessage(e?.code, lang) || t(lang, 'vehicleCommandFailed'))
      }
      return false
    } finally {
      if (mounted.current) setSending(false)
    }
  }, [lang, refreshDevices, sending, vehicle?.id, fetchActiveCommand])

  // Cancel a cut that is still waiting for the signal, with the dedicated cancel
  // endpoint (no opposite command is created, so nothing can run later).
  const cancelPending = useCallback(async () => {
    if (!vehicle?.id || !activeCommand?.id || sending) return false
    setSending(true); setError(''); setSuccess('')
    try {
      await api.devices.cancelCommand(vehicle.id, activeCommand.id)
      try { await fetchActiveCommand() } catch {}
      try { await refreshDevices?.() } catch {}
      return true
    } catch {
      if (mounted.current) setError(t(lang, 'vehicleCommandFailed'))
      return false
    } finally {
      if (mounted.current) setSending(false)
    }
  }, [activeCommand?.id, fetchActiveCommand, lang, refreshDevices, sending, vehicle?.id])

  const clearFeedback = useCallback(() => { setError(''); setErrorCode(null); setSuccess('') }, [])

  const deviceReplyInfo = describeDeviceReply(deviceReply, lang)

  const cutPending = isCutPending(activeCommand)
  const resumePending = isResumePending(activeCommand)
  // Only a command that has not left the server yet can be cancelled; once it was
  // handed to the tracker ('sent') the endpoint can no longer recall it.
  const cutCancellable = cutPending && ['requested', 'pending'].includes(activeCommand?.status)
  const cutSent = cutPending && activeCommand?.status === 'sent'

  return { engineRunning, canControl, reachable, cutPending, cutCancellable, cutSent, resumePending, cancelPending, sending, error, errorCode, success, send, clearFeedback, activeCommand, commandLoading, deviceReply, deviceReplyInfo }
}

export default useEngineControl
