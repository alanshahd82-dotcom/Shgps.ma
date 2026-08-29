import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { useApp } from '../context/AppContext'
import { t } from '../i18n/translations'

// Single source of truth for the engine relay control.
// The vehicle detail page (the button that is known to work in production) is
// the reference behaviour; every other place — cards, admin drawer, maps —
// must use this hook so the availability rules, the relay command and the
// feedback messages are identical everywhere.

const ONLINE_WINDOW_MS = 15 * 60 * 1000

export function isVehicleReachable(vehicle) {
  if (!vehicle) return false
  const lastUp = vehicle.lastUpdate ?? vehicle.fixTime ?? vehicle.last_update
  const fresh = lastUp ? (Date.now() - new Date(lastUp).getTime()) < ONLINE_WINDOW_MS : false
  return fresh || vehicle.status === 'online'
}

// Many GT06 trackers never report `ignition`; an unknown state must not hide
// or invert the relay control — unknown is treated as running.
export function isEngineRunning(vehicle) {
  const raw = vehicle?.engineOn ?? vehicle?.ignition
  return raw !== false
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
    try {
      const response = await api.devices.sendCommand(vehicle.id, turnOff ? 'engineStop' : 'engineResume')
      // Traccar answers with a command id when the tracker is not connected:
      // the relay order is stored and delivered on the next session.
      const queued = response?.queueState === 'queued'
      if (mounted.current) {
        setSuccess(queued
          ? (lang === 'ar'
              ? 'تم تسجيل الأمر — سيصل إلى الجهاز عند أول اتصال'
              : 'Commande enregistrée — elle sera transmise à la prochaine connexion')
          : t(lang, turnOff ? 'engineCutSuccess' : 'engineStartSuccess'))
      }
      // Read the actual state after the command instead of inferring it.
      try {
        const refreshed = await api.devices.get(vehicle.id)
        if (mounted.current && typeof refreshed?.engineOn === 'boolean') setEngineState(refreshed.engineOn)
      } catch {}
      try { await refreshDevices?.() } catch {}
      return true
    } catch {
      if (mounted.current) setError(t(lang, 'vehicleCommandFailed'))
      return false
    } finally {
      if (mounted.current) setSending(false)
    }
  }, [lang, refreshDevices, sending, vehicle?.id])

  const clearFeedback = useCallback(() => { setError(''); setSuccess('') }, [])

  return { engineRunning, canControl, sending, error, success, send, clearFeedback }
}

export default useEngineControl
