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

  // POST /api/devices (add device)
  addDevice: z.object({
    imei: z.string().regex(/^\d{15}$/, 'IMEI must be exactly 15 digits'),
    name: z.string().min(1, 'Device name is required').max(255),
  }),

  // PUT/PATCH /api/devices/:id (update device)
  updateDevice: z.object({
    name:  z.string().min(1).max(255).optional(),
    plate: z.string().max(50).optional(),
  }).partial(),

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
