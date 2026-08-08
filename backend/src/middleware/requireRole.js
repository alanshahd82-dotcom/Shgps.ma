/**
 * requireRole(...roles)
 *
 * Passes the request only if the authenticated user holds one of the given roles.
 * Main account owners (parent_client_id IS NULL) and admins always pass.
 * Sub-users must have an explicit matching role.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    // System admins and primary account owners bypass role checks
    if (req.user.is_admin || !req.user.parent_client_id) return next()
    // Sub-users must hold one of the required roles
    if (roles.includes(req.user.role)) return next()
    return res.status(403).json({ error: 'Insufficient permissions for this action' })
  }
}
