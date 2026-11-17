import { describe, expect, it } from 'vitest'
import { envFile, generateKeys } from '../src/vapid.js'

describe('vapid', () => {
  it('generates a url-safe key pair of the right size', () => {
    const k = generateKeys()
    expect(Buffer.from(k.publicKey, 'base64url')).toHaveLength(65)
    expect(Buffer.from(k.privateKey, 'base64url')).toHaveLength(32)
    expect(k.publicKey).not.toBe(generateKeys().publicKey)
  })
  it('writes an env file', () => {
    const k = generateKeys()
    const e = envFile(k, 'mailto:a@b.c')
    expect(e).toContain(`VAPID_PUBLIC_KEY=${k.publicKey}`)
    expect(e).toContain('VAPID_SUBJECT=mailto:a@b.c')
  })
})
