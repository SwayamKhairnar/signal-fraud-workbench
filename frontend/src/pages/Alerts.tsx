import { useCallback, useMemo, useState } from 'react'
import CaseDetail from './CaseDetail'
import type { Batch, Explanation, Transaction } from '../lib/api'
import { thresholdMetrics } from '../lib/metrics'
import { loadReviews, resetReviews, saveReviews, type Reviews, type ReviewStatus } from '../lib/reviews'

const percent = (value: number) => `${(value * 100).toFixed(value < .01 ? 2 : 1)}%`
const whole = new Intl.NumberFormat('en')

// ── Metric tooltip definitions ────────────────────────────────────────────────
const METRIC_DEFS: Record<string, string> = {
  Precision: 'Of the transactions flagged as alerts, the share that are actually labeled fraud. Higher = fewer false alarms.',
  Recall: 'Of all labeled fraud transactions, the share the model caught at this threshold. Higher = fewer missed frauds.',
  F1: 'The harmonic mean of precision and recall. A balanced measure when both matter.',
  'Fraud caught': 'True positives — labeled fraud transactions that were correctly flagged.',
  'False alarms': 'False positives — legitimate transactions incorrectly flagged as suspicious.',
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="threshold-metric-badge"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {label} <strong>{value}</strong>
      {open && METRIC_DEFS[label] && (
        <span className="metric-tooltip" role="tooltip">{METRIC_DEFS[label]}</span>
      )}
    </span>
  )
}

type Props = {
  batch: Batch
  merchants: string[]
}

export default function Alerts({ batch, merchants }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [cache, setCache] = useState<Record<string, Explanation>>({})
  const [threshold, setThreshold] = useState(batch.default_threshold)
  const [reviews, setReviews] = useState<Reviews>(() => loadReviews(batch.batch_hash, batch.model_version))
  const onCache = useCallback((id: string, data: Explanation) => setCache(current => ({ ...current, [id]: data })), [])
  const categories = useMemo(() => [...new Set(batch.rows.map(row => row.category))].sort(), [batch])
  const queue = useMemo(
    () => batch.rows
      .filter(row => row.risk_score >= threshold)
      .sort((a, b) => b.risk_score - a.risk_score || a.transaction_id.localeCompare(b.transaction_id)),
    [batch, threshold]
  )
  const metrics = useMemo(() => thresholdMetrics(batch.rows, threshold), [batch, threshold])

  function reviewCase(id: string, status: ReviewStatus | null) {
    const next = { ...reviews }
    if (status) next[id] = status
    else delete next[id]
    setReviews(next)
    saveReviews(batch.batch_hash, batch.model_version, next)
  }

  const visible = queue.filter(row =>
    (category === 'all' || row.category === category) &&
    (!query || row.transaction_id.toLowerCase().includes(query.toLowerCase()) || row.merchant.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <main className="dashboard-main alerts-main">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> PRIORITY QUEUE</p>
          <h1>Alerts for review<span>.</span></h1>
          <p>Ranked transactions that crossed the saved model threshold. Open any case to see its model-derived factors.</p>
        </div>
      </div>

      <div className="alert-summary">
        <div>
          <span>FLAGGED TRANSACTIONS</span>
          <strong>{whole.format(queue.length)}</strong>
        </div>
        <div>
          <span>REVIEW THRESHOLD</span>
          <strong>{percent(threshold)}</strong>
        </div>
        <p>Scores help prioritize human review. A flag is not a confirmed fraud finding.</p>
      </div>

      <section className="threshold-panel">
        <div>
          <h2>Adjust alert workload</h2>
          <p>Reclassifies saved scores in this browser. The model and uploaded file stay the same.</p>
        </div>
        <label htmlFor="threshold-slider">Threshold: {percent(threshold)}</label>
        <input
          id="threshold-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(threshold * 100)}
          onChange={event => setThreshold(Number(event.target.value) / 100)}
        />
        <button onClick={() => setThreshold(batch.default_threshold)}>Reset to saved threshold</button>
        {batch.mode === 'evaluation' && (
          <div className="threshold-metrics">
            <MetricBadge label="Precision" value={percent(metrics.precision)} />
            <MetricBadge label="Recall" value={percent(metrics.recall)} />
            <MetricBadge label="F1" value={percent(metrics.f1)} />
            <MetricBadge label="Fraud caught" value={whole.format(metrics.confusion.tp)} />
            <MetricBadge label="False alarms" value={whole.format(metrics.confusion.fp)} />
          </div>
        )}
      </section>

      {/* Cost Calculator — F5 from analysis */}
      {batch.mode === 'evaluation' && (
        <CostCalculator tp={metrics.confusion.tp} fp={metrics.confusion.fp} fn={metrics.confusion.fn} />
      )}

      <div className="queue-tools">
        <label>
          Search ID or merchant
          <input type="search" placeholder="Find a transaction…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <label>
          Category
          <select value={category} onChange={event => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map(value => <option value={value} key={value}>{value.replace(/^es_/, '')}</option>)}
          </select>
        </label>
        <span>{whole.format(visible.length)} shown</span>
      </div>

      <div className="alerts-layout">
        <div className="queue-panel">
          {visible.length
            ? (
              <div className="queue-list">
                {visible.map((row, index) => (
                  <button
                    type="button"
                    className={`queue-row ${selected?.transaction_id === row.transaction_id ? 'selected' : ''}`}
                    key={row.transaction_id}
                    onClick={() => setSelected(row)}
                  >
                    <span className="queue-rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="queue-identity">
                      <strong>{row.transaction_id}</strong>
                      <small>
                        {row.category.replace(/^es_/, '')} · day {row.step}
                        {reviews[row.transaction_id] ? ` · ${reviews[row.transaction_id].replaceAll('_', ' ')}` : ''}
                      </small>
                    </span>
                    <span className="queue-amount">
                      {row.amount.toLocaleString('en', { maximumFractionDigits: 2 })} <small>units</small>
                    </span>
                    {/* Fraud label indicator — F9 */}
                    {row.fraud !== undefined && (
                      <span className={`queue-fraud-dot ${row.fraud === 1 ? 'fraud' : 'legit'}`} title={row.fraud === 1 ? 'Known fraud' : 'Known legitimate'} />
                    )}
                    <span className="queue-risk">{percent(row.risk_score)}</span>
                    <span className="queue-arrow">↗</span>
                  </button>
                ))}
              </div>
            )
            : <div className="queue-empty">No alerts match these filters. Clear the search or choose another category.</div>
          }
        </div>

        {selected && (
          <CaseDetail
            row={selected}
            cache={cache}
            onCache={onCache}
            onClose={() => setSelected(null)}
            review={reviews[selected.transaction_id]}
            onReview={status => reviewCase(selected.transaction_id, status)}
            categories={categories}
            merchants={merchants}
            queue={visible}
            onSelectRow={setSelected}
          />
        )}
      </div>

      <div className="reviews-footer">
        <span>{Object.keys(reviews).length} browser-local review decisions for this batch</span>
        <button onClick={() => { resetReviews(batch.batch_hash, batch.model_version); setReviews({}) }}>Reset all reviews</button>
      </div>
    </main>
  )
}

// ── Cost Calculator component ─────────────────────────────────────────────────
function CostCalculator({ fp, fn }: { tp: number; fp: number; fn: number }) {
  const [costFn, setCostFn] = useState(5000)  // cost of a missed fraud (false negative)
  const [costFp, setCostFp] = useState(200)   // cost of a false alarm (false positive)
  const totalCost = fn * costFn + fp * costFp
  const fmt = new Intl.NumberFormat('en')

  return (
    <section className="cost-calculator">
      <div className="cost-header">
        <h2>Expected review cost</h2>
        <p>Adjust the cost assumptions to see how the current threshold affects total operational cost. Updates live with the slider above.</p>
      </div>
      <div className="cost-inputs">
        <label>
          Cost of missed fraud (₹)
          <input
            type="number"
            min="0"
            step="100"
            value={costFn}
            onChange={e => setCostFn(Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label>
          Cost of false alarm (₹)
          <input
            type="number"
            min="0"
            step="10"
            value={costFp}
            onChange={e => setCostFp(Math.max(0, Number(e.target.value)))}
          />
        </label>
      </div>
      <div className="cost-breakdown">
        <div>
          <span>Missed frauds × cost</span>
          <strong>₹{fmt.format(fn * costFn)}</strong>
          <small>{fn} missed × ₹{fmt.format(costFn)}</small>
        </div>
        <span className="cost-plus">+</span>
        <div>
          <span>False alarms × cost</span>
          <strong>₹{fmt.format(fp * costFp)}</strong>
          <small>{fp} false alarms × ₹{fmt.format(costFp)}</small>
        </div>
        <span className="cost-plus">=</span>
        <div className="cost-total">
          <span>Total expected cost</span>
          <strong>₹{fmt.format(totalCost)}</strong>
        </div>
      </div>
    </section>
  )
}
