import { useCallback, useMemo, useState } from 'react'
import CaseDetail from './CaseDetail'
import type { Batch, Explanation, Transaction } from '../lib/api'
import { thresholdMetrics } from '../lib/metrics'
import { loadReviews, resetReviews, saveReviews, type Reviews, type ReviewStatus } from '../lib/reviews'

const percent = (value: number) => `${(value * 100).toFixed(value < .01 ? 2 : 1)}%`
const whole = new Intl.NumberFormat('en')

export default function Alerts({ batch }: { batch: Batch }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [cache, setCache] = useState<Record<string, Explanation>>({})
  const [threshold, setThreshold] = useState(batch.default_threshold)
  const [reviews, setReviews] = useState<Reviews>(() => loadReviews(batch.batch_hash, batch.model_version))
  const onCache = useCallback((id: string, data: Explanation) => setCache(current => ({ ...current, [id]: data })), [])
  const categories = useMemo(() => [...new Set(batch.rows.map(row => row.category))].sort(), [batch])
  const queue = useMemo(() => batch.rows.filter(row => row.risk_score >= threshold).sort((a, b) => b.risk_score - a.risk_score || a.transaction_id.localeCompare(b.transaction_id)), [batch, threshold])
  const metrics = useMemo(() => thresholdMetrics(batch.rows, threshold), [batch, threshold])
  function reviewCase(id: string, status: ReviewStatus | null) {
    const next = { ...reviews }
    if (status) next[id] = status
    else delete next[id]
    setReviews(next); saveReviews(batch.batch_hash, batch.model_version, next)
  }
  const visible = queue.filter(row => (category === 'all' || row.category === category) && (!query || row.transaction_id.toLowerCase().includes(query.toLowerCase()) || row.merchant.toLowerCase().includes(query.toLowerCase())))
  return <main className="dashboard-main alerts-main">
    <div className="dashboard-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> PRIORITY QUEUE</p><h1>Alerts for review<span>.</span></h1><p>Ranked transactions that crossed the saved model threshold. Open any case to see its model-derived factors.</p></div></div>
    <div className="alert-summary"><div><span>FLAGGED TRANSACTIONS</span><strong>{whole.format(queue.length)}</strong></div><div><span>REVIEW THRESHOLD</span><strong>{percent(threshold)}</strong></div><p>Scores help prioritize human review. A flag is not a confirmed fraud finding.</p></div>
    <section className="threshold-panel"><div><h2>Adjust alert workload</h2><p>Reclassifies saved scores in this browser. The model and uploaded file stay the same.</p></div><label htmlFor="threshold-slider">Threshold: {percent(threshold)}</label><input id="threshold-slider" type="range" min="0" max="100" step="1" value={Math.round(threshold * 100)} onChange={event => setThreshold(Number(event.target.value) / 100)} /><button onClick={() => setThreshold(batch.default_threshold)}>Reset to saved threshold</button>{batch.mode === 'evaluation' && <div className="threshold-metrics"><span>Precision <strong>{percent(metrics.precision)}</strong></span><span>Recall <strong>{percent(metrics.recall)}</strong></span><span>F1 <strong>{percent(metrics.f1)}</strong></span><span>Fraud caught <strong>{whole.format(metrics.confusion.tp)}</strong></span><span>False alarms <strong>{whole.format(metrics.confusion.fp)}</strong></span></div>}</section>
    <div className="queue-tools"><label>Search ID or merchant<input type="search" placeholder="Find a transaction…" value={query} onChange={event => setQuery(event.target.value)} /></label><label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(value => <option value={value} key={value}>{value.replace(/^es_/, '')}</option>)}</select></label><span>{whole.format(visible.length)} shown</span></div>
    <div className="alerts-layout"><div className="queue-panel">
      {visible.length ? <div className="queue-list">{visible.map((row, index) => <button type="button" className={`queue-row ${selected?.transaction_id === row.transaction_id ? 'selected' : ''}`} key={row.transaction_id} onClick={() => setSelected(row)}><span className="queue-rank">{String(index + 1).padStart(2, '0')}</span><span className="queue-identity"><strong>{row.transaction_id}</strong><small>{row.category.replace(/^es_/, '')} · day {row.step}{reviews[row.transaction_id] ? ` · ${reviews[row.transaction_id].replaceAll('_', ' ')}` : ''}</small></span><span className="queue-amount">{row.amount.toLocaleString('en', { maximumFractionDigits: 2 })} <small>units</small></span><span className="queue-risk">{percent(row.risk_score)}</span><span className="queue-arrow">↗</span></button>)}</div> : <div className="queue-empty">No alerts match these filters. Clear the search or choose another category.</div>}
    </div>{selected && <CaseDetail row={selected} cache={cache} onCache={onCache} onClose={() => setSelected(null)} review={reviews[selected.transaction_id]} onReview={status => reviewCase(selected.transaction_id, status)} categories={categories} />}</div>
    <div className="reviews-footer"><span>{Object.keys(reviews).length} browser-local review decisions for this batch</span><button onClick={() => { resetReviews(batch.batch_hash, batch.model_version); setReviews({}) }}>Reset all reviews</button></div>
  </main>
}
