import { useEffect, useState } from 'react'
import ReasonBars from '../components/ReasonBars'
import { explainTransaction, type Explanation, type Transaction } from '../lib/api'
import type { ReviewStatus } from '../lib/reviews'
import WhatIf from '../components/WhatIf'

const scorePercent = (score: number) => `${(score * 100).toFixed(score < .01 ? 2 : 1)}%`

export default function CaseDetail({ row, cache, onCache, onClose, review, onReview, categories }: { row: Transaction; cache: Record<string, Explanation>; onCache: (id: string, data: Explanation) => void; onClose: () => void; review?: ReviewStatus; onReview: (status: ReviewStatus | null) => void; categories: string[] }) {
  const [error, setError] = useState('')
  useEffect(() => {
    if (cache[row.transaction_id]) return
    let active = true
    explainTransaction(row).then(data => { if (active) onCache(row.transaction_id, data) }).catch(() => { if (active) setError('Could not load the model explanation. Try opening this case again.') })
    return () => { active = false }
  }, [row, cache, onCache])
  const explanation = cache[row.transaction_id]
  return <aside className="case-detail" aria-label={`Case ${row.transaction_id}`}>
    <div className="case-header"><div><p className="section-kicker">TRANSACTION DETAIL</p><h2>{row.transaction_id}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close case">×</button></div>
    <div className="case-score"><span>Model risk score</span><strong>{scorePercent(row.risk_score)}</strong><p>A ranking score from the saved model, not a calibrated real-world fraud probability.</p></div>
    <dl className="case-facts"><div><dt>Amount</dt><dd>{row.amount.toLocaleString('en', { maximumFractionDigits: 2 })} units</dd></div><div><dt>Simulation day</dt><dd>{row.step}</dd></div><div><dt>Category</dt><dd>{row.category.replace(/^es_/, '').replace(/and/g, ' & ')}</dd></div><div><dt>Merchant code</dt><dd>{row.merchant}</dd></div>{row.fraud !== undefined && <div><dt>Known label</dt><dd>{row.fraud ? 'Fraud' : 'Legitimate'}</dd></div>}</dl>
    <div className="case-reasons-heading"><h3>What moved this score?</h3><p>Contributions are grouped by the four model inputs.</p></div>
    {error ? <p role="alert" className="case-error">{error}</p> : explanation ? <ReasonBars explanation={explanation} /> : <p className="case-loading" role="status">Loading model-derived reasons…</p>}
    <div className="review-box"><h3>Analyst review</h3><p>Your decision is stored only in this browser for this batch. It does not change the source label or model metrics.</p><div><button className={review === 'needs_review' ? 'selected' : ''} onClick={() => onReview('needs_review')}>Needs review</button><button className={review === 'confirmed_fraud' ? 'selected' : ''} onClick={() => onReview('confirmed_fraud')}>Confirmed fraud</button><button className={review === 'false_alarm' ? 'selected' : ''} onClick={() => onReview('false_alarm')}>False alarm</button></div>{review && <button className="clear-review" onClick={() => onReview(null)}>Clear decision</button>}</div>
    <WhatIf key={row.transaction_id} row={row} categories={categories} />
  </aside>
}
