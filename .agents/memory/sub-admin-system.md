---
name: Sub-admin system
description: How sub-admin accounts work in ATHAR GPS — DB schema, auth, scoping, and frontend
---

## DB columns added to `users`
- `is_sub_admin BOOLEAN DEFAULT false`
- `parent_admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE`
- `admin_permissions JSONB` — keys: add_clients, add_devices, view_reports, view_map, view_alerts, device_setup, support_settings

## Junction table
`sub_admin_client_access(sub_admin_id, client_id)` — controls which clients a sub-admin can see.

## Auth middleware
- `requireAdmin` — allows both main admin and sub-admin (is_admin=true)
- `requireMainAdmin` — only main admin (is_admin=true AND is_sub_admin=false); used on /api/sub-admins routes

**Why:** Sub-admins have is_admin=true so they pass requireAdmin for normal admin routes, but are blocked by requireMainAdmin from managing other sub-admins or sensitive settings.

## Scoped filtering
- `clients.js GET /`: if is_sub_admin → JOIN sub_admin_client_access; else all clients
- `devices.js GET /`: if is_sub_admin → WHERE user_id IN (SELECT client_id FROM sub_admin_client_access WHERE sub_admin_id=$1)

## Auth responses
`/auth/login` and `/auth/me` now return `isSubAdmin`, `adminPermissions`, `parentAdminId`.

## Frontend
- Route: `/admin/sub-admins` → `src/pages/admin/SubAdmins.jsx`
- AdminLayout sidebar: Sub-Admins link shown only when `!isSubAdmin`; map/alerts/setup hidden based on adminPermissions
- Sub-admins log in via same `/admin/login` page
