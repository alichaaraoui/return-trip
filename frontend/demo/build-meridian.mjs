// Writes public/meridian.html: the stand-in Meridian quote page, filled with the quotes Return Trip
// really created in the Meridian sandbox (from demo/snapshot.json).
import fs from 'node:fs'
const here = new URL('.', import.meta.url)
const snap = JSON.parse(fs.readFileSync(new URL('snapshot.json', here)))
const NAMES = { NORTHSTAR: 'Northstar Manufacturing', MIDWAYDST: 'Midway Distributors', IRONPEAK: 'Ironpeak Fabrication' }
const quotes = {}
for (const a of snap['GET /api/actions'].items) {
  const r = a.result || {}, p = a.payload || {}
  if (a.status !== 'done' || !r.quote_id) continue
  quotes[r.quote_id] = { ...p, sell: r.sell_total, customer: NAMES[p.customer_id] || p.customer_id, equipment: p.equipment_type,
    valid_until: (r.summary?.match(/valid until (\S+)/) || [])[1] || '', references: p.references || [], accessorials: p.accessorials || [] }
}
const html = fs.readFileSync(new URL('meridian-template.html', here), 'utf8')
  .replace('<script>', `<script>window.__QUOTES = ${JSON.stringify(quotes)};</script>\n<script>`)
fs.writeFileSync(new URL('../public/meridian.html', here), html)
console.log('meridian.html with quotes', Object.keys(quotes).join(', '))
