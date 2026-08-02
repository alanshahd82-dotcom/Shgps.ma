/**
 * أداة إنشاء مستخدم جديد في قاعدة البيانات
 * الاستخدام:
 *   node backend/src/db/create-user.js EMAIL PASSWORD "الاسم الكامل"
 * مثال:
 *   node backend/src/db/create-user.js client@shgps.ma Pass123 "محمد العلمي"
 */
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import dotenv from 'dotenv'
dotenv.config()

const [,, email, password, name = 'Client'] = process.argv

if (!email || !password) {
  console.error('الاستخدام: node backend/src/db/create-user.js EMAIL PASSWORD "الاسم"')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 10)

const { rows } = await db.query(
  `INSERT INTO users (email, password_hash, full_name, role, is_active)
   VALUES ($1, $2, $3, 'client', true)
   ON CONFLICT (email) DO UPDATE SET password_hash=$2, full_name=$3, is_active=true
   RETURNING id, email, full_name`,
  [email.toLowerCase().trim(), hash, name]
)

console.log('✅ مستخدم جاهز:', rows[0])
await db.end()
