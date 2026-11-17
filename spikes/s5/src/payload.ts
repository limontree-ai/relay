export type Kind = 'approval' | 'ready' | 'stalled'
export const kinds: Kind[] = ['approval', 'ready', 'stalled']

export function buildPayload(kind: Kind, id: string, sentAt: number) {
  const base = { id, kind, sentAt, url: `/a/${id}` }
  if (kind === 'approval') return { ...base, title: 'Approval needed', body: 'laptop-1 wants to run: npm run deploy', requireInteraction: true }
  if (kind === 'ready') return { ...base, title: 'Run finished', body: 'laptop-1 finished: fix the login bug' }
  return { ...base, title: 'Run stalled', body: 'laptop-1 has not moved for 10 minutes' }
}
