#!/usr/bin/env node
// backend/src/db/verify-engine-commands.js
// READ-ONLY verification. Run AFTER deploy + backend restart (runMigrations
// creates engine_commands). Does NOT modify any table, does NOT send commands.
//   node src/db/verify-engine-commands.js
import dotenv from 'dotenv'
import { db } from '../db.js'
dotenv.config()

async function tableExists(name){
  const { rows } = await db.query('SELECT to_regclass($1) AS oid', [name])
  return Boolean(rows[0] && rows[0].oid)
}
async function rowCount(name){
  const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM ' + name)
  return rows[0].c
}
async function columns(name){
  const { rows } = await db.query(
    'SELECT column_name, data_type, is_nullable, column_default ' +
      'FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
    [name]
  )
  return rows
}
async function indexes(name){
  const { rows } = await db.query(
    'SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1 ORDER BY indexname',
    [name]
  )
  return rows
}

console.log('=== engine_commands migration verification (read-only) ===')
const dcExists = await tableExists('device_commands')
const ecExists = await tableExists('engine_commands')
console.log('device_commands exists      :', dcExists)
console.log('engine_commands exists      :', ecExists)
if (dcExists) console.log('device_commands  COUNT(*)   :', await rowCount('device_commands'))
if (ecExists) console.log('engine_commands  COUNT(*)   :', await rowCount('engine_commands'))
if (dcExists){
  console.log('--- device_commands columns (legacy, must be unchanged) ---')
  for (const c of await columns('device_commands')) console.log('  ', c.column_name, c.data_type, c.is_nullable, c.column_default || '')
}
if (ecExists){
  console.log('--- engine_commands columns (new) ---')
  for (const c of await columns('engine_commands')) console.log('  ', c.column_name, c.data_type, c.is_nullable, c.column_default || '')
  console.log('--- engine_commands indexes ---')
  for (const i of await indexes('engine_commands')) console.log('  ', i.indexname)
}
console.log('=== done (read-only, no writes) ===')
await db.end()
