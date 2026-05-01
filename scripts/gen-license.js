#!/usr/bin/env node
/**
 * DevLauncher license key generator
 *
 * Usage:
 *   DEVLAUNCHER_LICENSE_SECRET=<secret> node scripts/gen-license.js [tier] [days]
 *
 *   tier  — 'pro' or 'teams'  (default: pro)
 *   days  — validity in days  (default: 365)
 *
 * Example:
 *   DEVLAUNCHER_LICENSE_SECRET=mysecret node scripts/gen-license.js pro 365
 */

const { createHmac, randomBytes } = require('crypto')

const SECRET = process.env.DEVLAUNCHER_LICENSE_SECRET
if (!SECRET || SECRET === 'DL-DEV-PLACEHOLDER-REPLACE-BEFORE-SHIPPING') {
  console.error('ERROR: Set DEVLAUNCHER_LICENSE_SECRET env var to the real secret before generating keys.')
  process.exit(1)
}

const tier   = (process.argv[2] || 'pro').toLowerCase()
const days   = parseInt(process.argv[3] || '365', 10)

if (!['pro', 'teams'].includes(tier)) {
  console.error("ERROR: tier must be 'pro' or 'teams'")
  process.exit(1)
}

const prefix = tier === 'pro' ? 'DLPRO' : 'DLTEA'

// Expiry date
const expiry = new Date()
expiry.setDate(expiry.getDate() + days)
const yyyy  = expiry.getFullYear()
const mm    = String(expiry.getMonth() + 1).padStart(2, '0')
const dd    = String(expiry.getDate()).padStart(2, '0')
const expires = `${yyyy}${mm}${dd}`

// Random 5-char A-Z nonce
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
let nonce = ''
const buf = randomBytes(5)
for (const b of buf) nonce += CHARS[b % 26]

// HMAC
const hmac = createHmac('sha256', SECRET)
  .update(`${tier}:${expires}:${nonce}`)
  .digest('hex')
  .slice(0, 12)
  .toUpperCase()

const key = `${prefix}-${expires}-${nonce}-${hmac}`

console.log(`\nLicense key (${tier}, expires ${yyyy}-${mm}-${dd}):\n`)
console.log(`  ${key}\n`)
