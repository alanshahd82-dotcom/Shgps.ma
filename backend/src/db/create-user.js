/**
 * إنشاء أو تحديث مستخدم في قاعدة البيانات
 * الاستخدام:
 *   node backend/src/db/create-user.js EMAIL PASSWORD "الاسم الكامل"
 * مثال:
 *   node backend/src/db/create-user.js client@athargps.ma Pass123 "محمد العلمي"
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
  `INSERT INTO users (email, password_hash, name, is_active)
   VALUES ($1, $2, $3, true)
   ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         name          = EXCLUDED.name,
         is_active     = true
   RETURNING id, email, name`,
  [email.toLowerCase().trim(), hash, name]
)

console.log('✅ مستخدم جاهز:', rows[0])
await db.end()
