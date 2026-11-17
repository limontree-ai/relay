import { existsSync, writeFileSync } from 'node:fs'
import { envFile, generateKeys } from '../src/vapid.js'

if (existsSync('.env.local') && !process.argv.includes('--force')) {
  console.log('.env.local exists, pass --force to overwrite')
  process.exit(1)
}
writeFileSync('.env.local', envFile(generateKeys(), process.env.VAPID_SUBJECT), { mode: 0o600 })
console.log('wrote .env.local (gitignored)')
