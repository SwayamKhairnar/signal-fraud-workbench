import { useEffect, useState } from 'react'
import ReasonBars from '../components/ReasonBars'
import { explainTransaction, type Explanation, type Transaction } from '../lib/api'
import type { ReviewStatus } from '../lib/reviews'
import WhatIf from '../components/WhatIf'

const scorePercent = (score: number) => `${(score * 100).toFixed(score < .01 ? 2 : 1)}%`

// ── Score gauge: a simple SVG arc from green → amber → red ───────────────────
function ScoreGauge({ score }: { score: number }) {
  const r = 42
  const cx = 56
  const cy = 56
  const startAngle = -210  // degrees (bottom-left)
  const sweepTotal = 240   // degrees of arc

  function polar(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  function arcPath(from: number, to: number, radius: number) {
    const s = polar(from, radius)
    const e = polar(to, radius)
    const large = to - from > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  // Map 0–1 score to color: green → amber → red
  const hue = Math.round(120 - score * 120)
  const color = `hsl(${hue}, 70%, 42%)`
  const fillEnd = startAngle + sweepTotal * score

  return (
    <svg width="112" height="80" viewBox="0 0 112 80" aria-label={`Risk gauge: ${scorePercent(score)}`} role="img">
      {/* Track */}
      <path
        d={arcPath(startAngle, startAngle + sweepTotal, r)}
        fill="none"
        stroke="var(--border)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Fill */}
      {score > 0 && (
        <path
          d={arcPath(startAngle, Math.min(fillEnd, startAngle + sweepTotal - 0.5), r)}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
      {/* Score label */}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="14" fontWeight="800" fill={color} fontFamily="Manrope, sans-serif">
        {scorePercent(score)}
      </text>
    </svg>
  )
}

type Props = {
  row: Transaction
  cache: Record<string, Explanation>
  onCache: (id: string, data: Explanation) => void
  onClose: () => void
  review?: ReviewStatus
  onReview: (status: ReviewStatus | null) => void
  categories: string[]
  merchants: string[]
  showLabel: boolean
  /** Sibling rows in the visible queue — used for keyboard navigation */
  queue?: Transaction[]
  onSelectRow?: (row: Transaction) => void
}

export default function CaseDetail({
  row,
  cache,
  onCache,
  onClose,
  review,
  onReview,
  categories,
  merchants,
  showLabel,
  queue = [],
  onSelectRow,
}: Props) {
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    if (cache[row.transaction_id]) return
    let active = true
    explainTransaction(row)
      .then(data => { if (active) onCache(row.transaction_id, data) })
      .catch(() => { if (active) setError('Could not load the model explanation. Try opening this case again.') })
    return () => { active = false }
  }, [row, cache, onCache])

  // Keyboard navigation: ← / → arrows move between queue items
  useEffect(() => {
    if (!onSelectRow || queue.length === 0) return
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      // Only fire when focus is inside the case panel or no input is focused
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return
      const idx = queue.findIndex(r => r.transaction_id === row.transaction_id)
      if (e.key === 'ArrowLeft' && idx > 0) onSelectRow?.(queue[idx - 1])
      if (e.key === 'ArrowRight' && idx < queue.length - 1) onSelectRow?.(queue[idx + 1])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [row, queue, onSelectRow])

  const explanation = cache[row.transaction_id]
  const queueIdx = queue.findIndex(r => r.transaction_id === row.transaction_id)
  const hasPrev = queueIdx > 0
  const hasNext = queueIdx >= 0 && queueIdx < queue.length - 1

  return (
    <aside className="case-detail" aria-label={`Case ${row.transaction_id}`}>
      <div className="case-header">
        <div>
          <p className="section-kicker">TRANSACTION DETAIL</p>
          <h2>{row.transaction_id}</h2>
        </div>
        <div className="case-nav-buttons">
          {onSelectRow && (
            <>
              <button
                className="icon-button"
                onClick={() => hasPrev && onSelectRow(queue[queueIdx - 1])}
                disabled={!hasPrev}
                aria-label="Previous alert"
                title="Previous alert (←)"
              >‹</button>
              <button
                className="icon-button"
                onClick={() => hasNext && onSelectRow(queue[queueIdx + 1])}
                disabled={!hasNext}
                aria-label="Next alert"
                title="Next alert (→)"
              >›</button>
            </>
          )}
          <button className="icon-button" onClick={onClose} aria-label="Close case">×</button>
        </div>
      </div>

      {/* Score gauge */}
      <div className="case-score">
        <ScoreGauge score={row.risk_score} />
        <div className="case-score-text">
          <span>Model risk score</span>
          <p>A ranking score from the saved model, not a calibrated real-world fraud probability.</p>
        </div>
      </div>

      <dl className="case-facts">
        <div><dt>Amount</dt><dd>{row.amount.toLocaleString('en', { maximumFractionDigits: 2 })} units</dd></div>
        <div><dt>Simulation day</dt><dd>{row.step}</dd></div>
        <div><dt>Category</dt><dd>{row.category.replace(/^es_/, '').replace(/and/g, ' & ')}</dd></div>
        <div><dt>Merchant code</dt><dd>{row.merchant}</dd></div>
        {showLabel && row.fraud !== undefined && (
          <div>
            <dt>Known label</dt>
            <dd>{row.fraud ? '🔴 Fraud' : '🟢 Legitimate'}</dd>
          </div>
        )}
      </dl>

      <div className="case-reasons-heading">
        <h3>What moved this score?</h3>
        <p>Contributions are grouped by the four model inputs.</p>
      </div>

      {error
        ? <p role="alert" className="case-error">{error}</p>
        : explanation
          ? (
            <>
              {/* Plain-English summary — F8 */}
              {explanation.plain_english_summary && (
                <p className="plain-english-summary">
                  <span className="plain-english-icon" aria-hidden="true">💬</span>
                  {explanation.plain_english_summary}
                </p>
              )}
              <ReasonBars explanation={explanation} />
            </>
          )
          : <p className="case-loading" role="status">Loading model-derived reasons…</p>
      }

      <div className="review-box">
        <h3>Analyst review</h3>
        <p>Your decision is stored only in this browser for this batch. It does not change the source label or model metrics.</p>
        <div>
          <button className={review === 'needs_review' ? 'selected' : ''} onClick={() => onReview('needs_review')}>Needs review</button>
          <button className={review === 'confirmed_fraud' ? 'selected' : ''} onClick={() => onReview('confirmed_fraud')}>Confirmed fraud</button>
          <button className={review === 'false_alarm' ? 'selected' : ''} onClick={() => onReview('false_alarm')}>False alarm</button>
        </div>
        {review && <button className="clear-review" onClick={() => onReview(null)}>Clear decision</button>}
      </div>

      <WhatIf key={row.transaction_id} row={row} original={explanation} categories={categories} merchants={merchants} />
    </aside>
  )
}
