import { z } from 'zod'

// ── Schemas ────────────────────────────────────────────────────────────────

export const schemas = {

  // POST /api/auth/login
  login: z.object({
    email:    z.string().email('A valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),

  // POST /api/auth/change-password
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
  }),

  // PUT /api/auth/profile
  updateProfile: z.object({
    name:              z.string().min(1).max(255).optional(),
    phone:             z.string().max(50).optional(),
    email:             z.string().email('A valid email is required').optional(),
    notificationPrefs: z.record(z.unknown()).optional(),
  }),

  // POST /api/auth/reset-password
  resetPassword: z.object({
    token:       z.string().min(1, 'Token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),

  // POST /api/devices (add device — full form, name required)
  addDevice: z.object({
    imei: z.string().regex(/^\d{15}$/, 'IMEI must be exactly 15 digits'),
    name: z.string().min(1, 'Device name is required').max(255),
  }),

  // POST /api/devices/quick-add — minimal form (imei + phone only)
  quickAddDevice: z.object({
    imei:                z.string().regex(/^\d{15}$/, 'IMEI must be exactly 15 digits'),
    phone:               z.string().min(6,  'Phone number is required'),
    clientId:            z.union([z.string(), z.number()]).optional(),
    maxDevices:          z.union([z.string(), z.number()]).optional(),
    subscriptionPlanId:  z.string().optional(),
    expiresAt:           z.string().datetime({ offset: true }).optional()
                           .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),

  // PUT/PATCH /api/devices/:id (update device)
  updateDevice: z.object({
    name:  z.string().min(1).max(255).optional(),
    plate: z.string().max(50).optional(),
  }).partial(),

  // PATCH /api/devices/:id/info — edit name / driver / plate
  updateDeviceInfo: z.object({
    name:   z.string().min(1).max(255).optional(),
    driver: z.string().max(120).optional(),
    plate:  z.string().max(50).optional(),
  }),

  // PATCH /api/devices/:id/subscription — renew device subscription
  updateDeviceSubscription: z.object({
    subscriptionPlanId: z.string().min(1, 'Subscription plan is required'),
  }),

  // POST /api/clients — create client
  createClient: z.object({
    name:         z.string().min(1, 'Name is required').max(255),
    email:        z.string().email('A valid email is required'),
    password:     z.string().min(8, 'Password must be at least 8 characters').optional(),
    phone:        z.string().max(50).optional(),
    subscription: z.string().max(50).optional(),
    maxDevices:   z.union([z.string(), z.number()]).optional(),
    expiryDate:   z.string().optional(),
  }),

  // PUT /api/clients/:id — update client
  updateClient: z.object({
    name:         z.string().min(1).max(255).optional(),
    phone:        z.string().max(50).optional(),
    city:         z.string().max(100).optional(),
    subscription: z.string().max(50).optional(),
    is_active:    z.boolean().optional(),
    maxDevices:   z.union([z.string(), z.number()]).optional(),
    expiryDate:   z.string().optional(),
  }),

  // POST /api/clients/:id/reset-password
  resetClientPassword: z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),

  // PATCH /api/clients/:id/subscription
  updateClientSubscription: z.object({
    expiryDate: z.string().nullable().optional(),
    plan:       z.string().max(50).optional(),
    maxDevices: z.union([z.string(), z.number()]).optional(),
    isActive:   z.boolean().optional(),
  }),

  // POST /api/clients/:id/devices — add device to client
  addClientDevice: z.object({
    name:               z.string().min(1, 'Device name is required').max(255),
    imei:               z.string().regex(/^\d{15}$/, 'IMEI must be exactly 15 digits'),
    type:               z.string().max(50).optional(),
    plate:              z.string().max(50).optional(),
    subscriptionPlanId: z.string().min(1, 'Subscription plan is required'),
  }),

  // POST /api/maintenance — create maintenance log
  createMaintenance: z.object({
    deviceId:       z.union([z.string().min(1), z.number().int().positive()]),
    type:           z.string().min(1, 'Type is required').max(50),
    note:           z.string().max(1000).optional(),
    mileage:        z.number().nonnegative().optional(),
    date:           z.string().optional(),
    nextDueMileage: z.number().nonnegative().optional(),
  }),

  // POST /api/sub-admins — create sub-admin
  createSubAdmin: z.object({
    name:             z.string().min(1, 'Name is required').max(255),
    email:            z.string().email('A valid email is required'),
    password:         z.string().min(8, 'Password must be at least 8 characters'),
    adminPermissions: z.record(z.boolean()).optional(),
  }),

  // PATCH /api/sub-admins/:id — update sub-admin
  updateSubAdmin: z.object({
    name:             z.string().min(1).max(255).optional(),
    isActive:         z.boolean().optional(),
    adminPermissions: z.record(z.boolean()).optional(),
    password:         z.string().min(8, 'Password must be at least 8 characters').optional(),
  }),

  // PUT /api/sub-admins/:id/clients — assign clients to sub-admin
  assignSubAdminClients: z.object({
    clientIds: z.array(z.union([z.string(), z.number()])),
  }),

  // PATCH /api/sub-users/:id — update sub-user role or status
  updateSubUser: z.object({
    role:     z.enum(['manager', 'viewer', 'reports', 'alerts']).optional(),
    isActive: z.boolean().optional(),
  }),

  // POST /api/sub-users (create sub-user)
  createSubUser: z.object({
    name:     z.string().min(1, 'Name is required'),
    email:    z.string().email('A valid email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),

  // POST /api/driver-behavior/scores
  driverBehaviorScore: z.object({
    deviceId:      z.union([z.string().min(1), z.number().int().positive()]),
    score:         z.number().min(0, 'score must be between 0 and 100').max(100, 'score must be between 0 and 100'),
    speedingEvents: z.number().int().min(0, 'speedingEvents must be a non-negative integer').optional(),
    idleMin:       z.number().int().min(0, 'idleMin must be a non-negative integer').optional(),
    tripCount:     z.number().int().min(0, 'tripCount must be a non-negative integer').optional(),
  }),

  // POST /api/geofences (create geofence)
  createGeofence: z.object({
    name:   z.string().min(1, 'Geofence name is required'),
    center: z.object({
      lat: z.number({ required_error: 'Latitude is required' }),
      lng: z.number({ required_error: 'Longitude is required' }),
    }),
    radius: z.number().positive('Radius must be a positive number'),
  }),
}

// ── Middleware factory ─────────────────────────────────────────────────────

/**
 * validateBody(schema) — validates req.body against a Zod schema.
 * Returns 400 with the first error message on failure.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const first = result.error.errors[0]
      return res.status(400).json({
        error:   first?.message || 'Validation failed',
        field:   first?.path?.join('.') || undefined,
        details: result.error.errors,
      })
    }
    next()
  }
}
