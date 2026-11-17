function parsePush(raw) {
  try {
    const d = raw ? JSON.parse(raw) : null
    if (d && typeof d === 'object') return d
  } catch {}
  return null
}

function buildNotification(raw, maxActions) {
  const d = parsePush(raw) || {}
  const id = typeof d.id === 'string' ? d.id : 'unknown'
  const title = typeof d.title === 'string' && d.title ? d.title : 'relay'
  const body = typeof d.body === 'string' && d.body ? d.body : 'Something needs your attention'
  const url = typeof d.url === 'string' && d.url.startsWith('/') ? d.url : `/a/${id}`
  const options = {
    body,
    icon: '/icon-192.png',
    tag: id,
    data: { id, url, kind: d.kind || 'unknown', sentAt: typeof d.sentAt === 'number' ? d.sentAt : null },
  }
  if (d.requireInteraction) options.requireInteraction = true
  if (maxActions > 0 && d.kind === 'approval') {
    options.actions = [
      { action: 'approve', title: 'Approve' },
      { action: 'deny', title: 'Deny' },
    ]
  }
  return { title, options }
}

function handlePush(event, reg, maxActions, ack) {
  const raw = event.data ? event.data.text() : ''
  const { title, options } = buildNotification(raw, maxActions)
  const work = Promise.resolve()
    .then(() => reg.showNotification(title, options))
    .then(() => ack && ack(options.data, Date.now()))
    .catch(() => {})
  event.waitUntil(work)
  return work
}

function clickTarget(data, action) {
  const base = (data && data.url) || '/'
  if (action === 'approve' || action === 'deny') return `${base}?action=${action}`
  return base
}

const api = { parsePush, buildNotification, handlePush, clickTarget }
self.swLogic = api
