import { useRef, useState } from 'react'
import { scoreScenario, type Explanation, type Scenario, type Transaction } from '../lib/api'
import ReasonBars from './ReasonBars'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

type Props = {
  row: Transaction
  original?: Explanation
  categories: string[]
  merchants: string[]
}

export default function WhatIf({ row, original, categories, merchants }: Props) {
  const [amount, setAmount] = useState(row.amount.toFixed(2))
  const [step, setStep] = useState(String(row.step))
  const [category, setCategory] = useState(row.category)
  const [merchant, setMerchant] = useState(row.merchant)
  const [result, setResult] = useState<Scenario | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const changes = result && original
    ? result.factors.map(factor => {
      const before = original.factors.find(item => item.factor === factor.factor)?.contribution ?? 0
      return { factor: factor.factor, before, after: factor.contribution, delta: factor.contribution - before }
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    : []

  function invalidateScenario() {
    requestId.current += 1
    setResult(null)
    setError('')
    setBusy(false)
  }

  async function run() {
    const currentRequest = ++requestId.current
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const value = Number(amount)
      if (!Number.isFinite(value) || value < 0) throw new Error('Enter a nonnegative amount.')
      const day = Number(step)
      if (!Number.isInteger(day) || day < 0) throw new Error('Enter a nonnegative whole simulation day.')
      const scenario = await scoreScenario({ transaction_id: row.transaction_id, step: day, merchant, category, amount: value })
      if (requestId.current === currentRequest) setResult(scenario)
    } catch (cause) {
      if (requestId.current === currentRequest) setError(cause instanceof Error ? cause.message : 'Could not score this scenario.')
    } finally {
      if (requestId.current === currentRequest) setBusy(false)
    }
  }

  return (
    <section className="what-if">
      <h3>What if this changed?</h3>
      <p>Try changing amount, day, merchant, or category. The original transaction remains untouched.</p>

      <div className="what-if-inputs">
        <label>
          Amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => { invalidateScenario(); setAmount(e.target.value) }}
          />
        </label>

        <label>
          Simulation day
          <input
            type="number"
            min="0"
            step="1"
            value={step}
            onChange={e => { invalidateScenario(); setStep(e.target.value) }}
          />
        </label>

        <label>
          Category
          <select value={category} onChange={e => { invalidateScenario(); setCategory(e.target.value) }}>
            {categories.map(v => (
              <option key={v} value={v}>{v.replace(/^es_/, '')}</option>
            ))}
          </select>
        </label>

        <label>
          Merchant
          <select value={merchant} onChange={e => { invalidateScenario(); setMerchant(e.target.value) }}>
            {!merchants.includes(row.merchant) && <option value={row.merchant}>{row.merchant}</option>}
            {merchants.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      <button className="secondary-button" onClick={() => void run()} disabled={busy}>
        {busy ? 'Scoring…' : 'Score scenario'}
      </button>

      {error && <p role="alert" className="case-error">{error}</p>}

      {result && (
        <>
          <div className="scenario-result">
            <span>Original <strong>{pct(row.risk_score)}</strong></span>
            <span>Hypothetical <strong>{pct(result.risk_score)}</strong></span>
            <em>{result.would_alert ? 'Would alert' : 'Would not alert'} at the saved threshold of {pct(result.threshold)}</em>
          </div>
          <h4 className="scenario-reasons-title">Hypothetical model factors</h4>
          <ReasonBars explanation={result} />
          {changes.length > 0 && <div className="scenario-delta">
            <h4>What changed the model score?</h4>
            <p>Differences below are exact changes in raw model log-odds contribution. They describe model behavior, not a cause of fraud.</p>
            {changes.map(item => <div key={item.factor}>
              <strong>{item.factor}</strong>
              <span>{item.before >= 0 ? '+' : ''}{item.before.toFixed(2)} → {item.after >= 0 ? '+' : ''}{item.after.toFixed(2)}</span>
              <b className={item.delta >= 0 ? 'positive-text' : 'negative-text'}>{item.delta >= 0 ? '+' : ''}{item.delta.toFixed(2)}</b>
            </div>)}
          </div>}
        </>
      )}
    </section>
  )
}
