// Account owners and admins can change data; sub-users need the "manager" role.
export function canManageAccount(user) {
  return !user || !user.parentClientId || user.role === 'manager'
}
