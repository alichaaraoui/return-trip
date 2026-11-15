// Online demo: answers the app's /api calls from a snapshot of the real backend (demo/snapshot.json),
// so the static build runs with no server. Approving, rejecting and switching modes change things only in
// this browser tab; nothing is sent to Meridian or anyone's inbox. Routes the snapshot doesn't have return
// 404, and api.js then falls back to its own data built from real Meridian loads (loops, hubs, drivers...).
import snapshot from '../demo/snapshot.json'

const clone = (x) => JSON.parse(JSON.stringify(x))
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')
const state = {
  actions: clone(snapshot['GET /api/actions'].items),
  audit: clone(snapshot['GET /api/audit'].items),
  mode: clone(snapshot['GET /api/mode']),
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const off = (what) => json({ error: 'demo', detail: `${what} is turned off in the online demo. In the live app it runs against Meridian.` }, 400)
const audit = (actor, event, detail) => state.audit.unshift({ at: nowIso(), actor, event, detail })

function decide(id, decision, reason) {
  const a = state.actions.find((x) => x.action_id === id)
  if (!a) return json({ error: 'not_found', detail: `Action ${id} not found.` }, 404)
  if (a.status !== 'pending') return json({ error: 'conflict', detail: `Action ${id} is already ${a.status}.` }, 409)
  a.status = decision === 'approve' ? 'done' : 'rejected'
  a.decided_by = 'human'
  a.updated_at = nowIso()
  a.result = decision === 'approve'
    ? { summary: `${a.title} — approved in the demo. In the live app this ${a.kind === 'send_reply' ? 'sends the reply' : 'creates the quote in Meridian'}.` }
    : { reason: reason || 'Rejected in the demo' }
  audit('human', decision === 'approve' ? 'action_approved' : 'action_rejected', `${id}: ${a.title}`)
  return json(a)
}

async function handle(method, path, body) {
  const [route, query] = path.split('?')
  if (method === 'GET' && route === '/api/actions') {
    const status = new URLSearchParams(query || '').get('status')
    return json({ items: clone(status ? state.actions.filter((a) => a.status === status) : state.actions) })
  }
  if (method === 'GET' && route === '/api/audit') return json({ items: clone(state.audit) })
  if (route === '/api/mode') {
    if (method === 'PUT') { state.mode.mode = body?.mode || state.mode.mode; audit('human', 'mode_changed', `mode → ${state.mode.mode}`) }
    return json(clone(state.mode))
  }
  let m
  if (method === 'POST' && (m = route.match(/^\/api\/actions\/([^/]+)\/(approve|reject)$/))) return decide(m[1], m[2], body?.reason)
  if (method === 'POST' && route === '/api/agent/chat') {
    const reply = snapshot.chat[body?.message]
    await new Promise((r) => setTimeout(r, 1800))
    audit('human', 'agent_message', body?.message || '')
    return json(reply ?? { reply: 'This online demo replays one real conversation with the agent. Try the suggested question; in the live app the agent answers anything, using Meridian.', tool_calls: [], actions_created: [] })
  }
  if (method === 'POST' && route === '/api/carriers/rank') return snapshot.ranks[body?.shipment_id] ? json(snapshot.ranks[body.shipment_id]) : json({ eligible: [], excluded: [] })
  if (method === 'POST' && route === '/api/email/simulate') return off('Sending a sample email')
  if (method === 'POST' && route === '/api/fill') return off('Filling a return trip')
  const hit = snapshot[`${method} ${route}`]
  if (hit) return json(clone(hit))
  return json({ error: 'not_found', detail: `${route} is not in the demo snapshot.` }, 404)
}

const realFetch = window.fetch.bind(window)
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  if (!url.startsWith('/api/')) return realFetch(input, init)
  const method = (init.method || 'GET').toUpperCase()
  let body = null
  try { body = init.body ? JSON.parse(init.body) : null } catch { /* not JSON */ }
  return handle(method, url, body)
}

// a small, honest label on the page
const tag = document.createElement('div')
tag.textContent = 'Online demo · real Meridian sandbox data · nothing is sent'
Object.assign(tag.style, { position: 'fixed', left: '14px', bottom: '10px', zIndex: 2000, font: '500 12px Inter, system-ui, sans-serif', color: '#3F4756',
  background: 'rgba(251,251,248,.9)', border: '1px solid rgba(20,24,31,.1)', borderRadius: '99px', padding: '6px 12px', pointerEvents: 'none' })
window.addEventListener('DOMContentLoaded', () => document.body.appendChild(tag))
