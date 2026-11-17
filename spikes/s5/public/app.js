const $ = (id) => document.getElementById(id)
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const status = (t) => ($('status').textContent = t)
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const mode = $('mode')
if (ios && !standalone) {
  mode.className = 'box warn'
  mode.textContent = 'Open from the home screen icon to enable notifications. On iPhone, Add to Home Screen first, then open the new icon.'
} else if (!supported) {
  mode.className = 'box warn'
  mode.textContent = 'This browser does not support Web Push.'
} else {
  mode.className = 'box ok'
  mode.textContent = standalone ? 'Running as a home screen app.' : 'Running in a browser tab.'
}

const canSubscribe = supported && !(ios && !standalone)

async function refresh() {
  if (!supported) return status('unsupported')
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  status(`permission=${Notification.permission}, subscribed=${!!sub}, maxActions=${Notification.maxActions ?? 'n/a'}`)
  $('test').disabled = !sub
  if (sub) post('/subscribe', sub.toJSON())
}

async function latencies() {
  const rows = await (await fetch('/latency')).json()
  $('lat').replaceChildren(
    ...rows.slice(-10).reverse().map((r) => {
      const tr = document.createElement('tr')
      for (const v of [r.kind, r.ms, new Date(r.ackAt).toLocaleTimeString()]) {
        const td = document.createElement('td')
        td.textContent = v
        tr.append(td)
      }
      return tr
    }),
  )
}

$('sub').disabled = !canSubscribe
$('sub').onclick = async () => {
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return status(`permission ${perm}`)
    const reg = await navigator.serviceWorker.ready
    const key = await (await fetch('/vapid-public-key')).text()
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }))
    const r = await post('/subscribe', sub.toJSON())
    status(r.ok ? 'subscribed' : `subscribe failed ${r.status}`)
    refresh()
  } catch (e) {
    status(`error: ${e.message}`)
  }
}

$('test').onclick = async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && (await reg.pushManager.getSubscription())
  const r = await post('/test-notification', { endpoint: sub?.endpoint })
  status(`test sent: ${r.status} ${JSON.stringify(await r.json())}`)
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(refresh)
  navigator.serviceWorker.addEventListener('message', latencies)
}
latencies()
setInterval(latencies, 5000)
