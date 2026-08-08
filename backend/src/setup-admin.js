#!/usr/bin/env node
// backend/src/setup-admin.js
// One-time CLI script to create the first admin account.
// Run after first deployment: node src/setup-admin.js
//
// Prerequisites: DATABASE_URL must be set in environment (or .env loaded).

import readline from 'readline'
import bcrypt   from 'bcryptjs'
import dotenv   from 'dotenv'
import { db }   from './db.js'

dotenv.config()

const rl  = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(resolve => rl.question(q, resolve))

console.log('\n=== ATHAR GPS — First Admin Setup ===\n')
const email    = (await ask('Admin email:    ')).trim()
const name     = (await ask('Admin name:     ')).trim() || 'مدير النظام'
const password = (await ask('Admin password: ')).trim()
rl.close()

if (!email || !password) {
  console.error('\n[ERROR] Email and password are required.')
  process.exit(1)
}
if (password.length < 8) {
  console.error('\n[ERROR] Password must be at least 8 characters.')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 12)
const avatar = name[0] || 'م'

const { rows } = await db.query(
  `INSERT INTO users (email, password_hash, name, is_admin, avatar)
   VALUES ($1, $2, $3, true, $4)
   ON CONFLICT (email) DO NOTHING
   RETURNING id, email`,
  [email, hash, name, avatar]
)

if (rows[0]) {
  console.log('\n✅ Admin account created:', rows[0].email, '(id:', rows[0].id + ')')
} else {
  console.log('\n⚠️  Account already exists for:', email, '— no changes made.')
}

process.exit(0)
