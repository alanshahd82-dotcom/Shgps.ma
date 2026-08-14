/**
 * Shared device ownership rules.
 *
 * Main admins can access the fleet. Sub-admins are limited to the clients
 * assigned to them. Client account owners can access their own devices, and
 * sub-users stay inside their parent account (with optional per-device rows).
 */
import { db } from '../db.js'

export function deviceAccessScope(user, alias = 'd', startIndex = 1) {
  if (user?.is_admin && !user?.is_sub_admin) {
    return { text: `${alias}.id IS NOT NULL`, values: [] }
  }

  if (user?.is_sub_admin) {
    return {
      text: `${alias}.user_id IN (
        SELECT client_id FROM sub_admin_client_access
        WHERE sub_admin_id=$${startIndex}
      )`,
      values: [user.id],
    }
  }

  const ownerId = user?.parent_client_id || user?.id
  if (user?.parent_client_id) {
    return {
      text: `${alias}.user_id=$${startIndex}
        AND (
          NOT EXISTS (
            SELECT 1 FROM user_device_access uda0
            WHERE uda0.sub_user_id=$${startIndex + 1}
          )
          OR EXISTS (
            SELECT 1 FROM user_device_access uda
            WHERE uda.sub_user_id=$${startIndex + 1}
              AND uda.device_id=${alias}.id
          )
        )`,
      values: [ownerId, user.id],
    }
  }

  return { text: `${alias}.user_id=$${startIndex}`, values: [ownerId] }
}

export async function getAccessibleDevice(db, user, deviceId) {
  const scope = deviceAccessScope(user, 'd', 2)
  const { rows } = await db.query(
    `SELECT d.* FROM devices d WHERE d.id=$1 AND (${scope.text})`,
    [deviceId, ...scope.values]
  )
  return rows[0] || null
}

/**
 * Authorize mutations on one concrete device.
 *
 * Reads and scoped sub-user access continue to use getAccessibleDevice().
 * Mutating a device is narrower: only the row owner or an administrator may
 * perform the operation. The full row is attached for downstream handlers.
 */
export async function requireDeviceOwner(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM devices WHERE id=$1 LIMIT 1',
      [req.params.id],
    )
    const device = rows[0]
    if (!device) return res.status(404).json({ error: 'Device not found' })

    const isOwner = String(device.user_id) === String(req.user?.id)
    const isAdministrator = Boolean(req.user?.is_admin)
    if (!isOwner && !isAdministrator) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    req.device = device
    return next()
  } catch (err) {
    console.error('[device-owner]', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
}
