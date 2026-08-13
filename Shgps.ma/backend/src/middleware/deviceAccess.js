/**
 * Shared device ownership rules.
 *
 * Main admins can access the fleet. Sub-admins are limited to the clients
 * assigned to them. Client account owners can access their own devices, and
 * sub-users stay inside their parent account (with optional per-device rows).
 */
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
