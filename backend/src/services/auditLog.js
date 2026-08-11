import { db } from '../db.js'

/**
 * logAudit(userId, action, targetType, targetId, metadata)
 *
 * Writes a row to audit_logs. Never throws — a logging failure must not
 * block the main operation.
 *
 * Run `node src/db/migrate-audit-log.js` once before using this service.
 */
export async function logAudit(userId, action, targetType = null, targetId = null, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, targetType, targetId ?? null, JSON.stringify(metadata)]
    )
  } catch (err) {
    console.warn('[AuditLog] Write failed (non-fatal):', err.message)
  }
}
