import webpush from 'web-push'

export const generateKeys = () => webpush.generateVAPIDKeys()

export function envFile(keys: { publicKey: string; privateKey: string }, subject = 'mailto:sweeya@limontree.example') {
  return `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=${subject}\n`
}
