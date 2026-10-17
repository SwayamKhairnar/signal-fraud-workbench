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
  const [shownCount, setShownCount] = useState(100)
  const [labelsRevealed, setLabelsRevealed] = useState(false)
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
  const displayed = visible.slice(0, shownCount)
  const decisions = batch.rows.filter(row => reviews[row.transaction_id] === 'confirmed_fraud' || reviews[row.transaction_id] === 'false_alarm')
  const matchingDecisions = decisions.filter(row =>
    (reviews[row.transaction_id] === 'confirmed_fraud' && row.fraud === 1) ||
    (reviews[row.transaction_id] === 'false_alarm' && row.fraud === 0)
  ).length

  function resetQueueView() {
    setSelected(null)
    setShownCount(100)
  }

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

      {batch.mode === 'evaluation' && (
        <section className="blind-review-panel" aria-label="Blind analyst review">
          <div>
            <h2>{labelsRevealed ? 'Known outcomes revealed' : 'Blind analyst review'}</h2>
            <p>{labelsRevealed
              ? 'Compare your browser-local decisions with the source labels. These decisions do not change model metrics.'
              : 'Source fraud labels are hidden in the queue and case details. Review cases first, then reveal their known outcomes.'}</p>
            {labelsRevealed && <p className="review-match">{matchingDecisions} of {decisions.length} fraud/false-alarm decisions match the known labels.</p>}
          </div>
          <button className="secondary-button" onClick={() => setLabelsRevealed(value => !value)}>
            {labelsRevealed ? 'Hide known outcomes' : 'Reveal known outcomes'}
          </button>
        </section>
      )}

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
          max="1000"
          step="1"
          value={Math.round(threshold * 1000)}
          onChange={event => { resetQueueView(); setThreshold(Number(event.target.value) / 1000) }}
        />
        <button onClick={() => { resetQueueView(); setThreshold(batch.default_threshold) }}>Reset to saved threshold</button>
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
        <CostCalculator fp={metrics.confusion.fp} fn={metrics.confusion.fn} />
      )}

      <div className="queue-tools">
        <label>
          Search ID or merchant
          <input type="search" placeholder="Find a transaction…" value={query} onChange={event => { resetQueueView(); setQuery(event.target.value) }} />
        </label>
        <label>
          Category
          <select value={category} onChange={event => { resetQueueView(); setCategory(event.target.value) }}>
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
                {displayed.map((row, index) => (
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
                        {reviews[row.transaction_id] ? ` · analyst: ${reviews[row.transaction_id].replaceAll('_', ' ')}` : ''}
                      </small>
                    </span>
                    <span className="queue-amount">
                      {row.amount.toLocaleString('en', { maximumFractionDigits: 2 })} <small>units</small>
                    </span>
                    {/* Fraud label indicator — F9 */}
                    {labelsRevealed && row.fraud !== undefined && (
                      <span className={`queue-fraud-dot ${row.fraud === 1 ? 'fraud' : 'legit'}`} title={row.fraud === 1 ? 'Known fraud' : 'Known legitimate'} aria-label={row.fraud === 1 ? 'Known fraud' : 'Known legitimate'} />
                    )}
                    <span className="queue-risk">{percent(row.risk_score)}</span>
                    <span className="queue-arrow">↗</span>
                  </button>
                ))}
              </div>
            )
            : <div className="queue-empty">No alerts match these filters. Clear the search or choose another category.</div>
          }
          {visible.length > shownCount && (
            <button className="secondary-button queue-more" onClick={() => setShownCount(count => count + 100)}>
              Show next {Math.min(100, visible.length - shownCount)} of {whole.format(visible.length)} alerts
            </button>
          )}
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
            showLabel={labelsRevealed}
            queue={displayed}
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
function CostCalculator({ fp, fn }: { fp: number; fn: number }) {
  const [costFn, setCostFn] = useState(10)
  const [costFp, setCostFp] = useState(1)
  const totalCost = fn * costFn + fp * costFp
  const fmt = new Intl.NumberFormat('en')
  const penalty = (value: string) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(1_000_000, Math.max(0, number)) : 0
  }

  return (
    <section className="cost-calculator">
      <div className="cost-header">
        <h2>Illustrative error cost</h2>
        <p>Choose penalty points for a missed fraud and a false alarm. This is a teaching scenario on this labeled batch, not a real bank cost estimate. It updates with the threshold above.</p>
      </div>
      <div className="cost-inputs">
        <label>
          Penalty per missed fraud (points)
          <input
            type="number"
            min="0"
            step="1"
            value={costFn}
            onChange={e => setCostFn(penalty(e.target.value))}
          />
        </label>
        <label>
          Penalty per false alarm (points)
          <input
            type="number"
            min="0"
            step="1"
            value={costFp}
            onChange={e => setCostFp(penalty(e.target.value))}
          />
        </label>
      </div>
      <div className="cost-breakdown">
        <div>
          <span>Missed frauds × cost</span>
          <strong>{fmt.format(fn * costFn)} points</strong>
          <small>{fn} missed × {fmt.format(costFn)} points</small>
        </div>
        <span className="cost-plus">+</span>
        <div>
          <span>False alarms × cost</span>
          <strong>{fmt.format(fp * costFp)} points</strong>
          <small>{fp} false alarms × {fmt.format(costFp)} points</small>
        </div>
        <span className="cost-plus">=</span>
        <div className="cost-total">
          <span>Total scenario penalty</span>
          <strong>{fmt.format(totalCost)} points</strong>
        </div>
      </div>
    </section>
  )
}
