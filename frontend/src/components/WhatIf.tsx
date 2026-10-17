import { useState } from 'react'
import { scoreScenario, type Scenario, type Transaction } from '../lib/api'
import ReasonBars from './ReasonBars'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export default function WhatIf({ row, categories }: { row: Transaction; categories: string[] }) {
  const [amount, setAmount] = useState(String(row.amount))
  const [step, setStep] = useState(String(row.step))
  const [category, setCategory] = useState(row.category)
  const [result, setResult] = useState<Scenario | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run() {
    setBusy(true); setError('')
    try {
      const value = Number(amount)
      if (!Number.isFinite(value) || value < 0) throw new Error('Enter a nonnegative amount.')
      const day = Number(step)
      if (!Number.isInteger(day) || day < 0) throw new Error('Enter a nonnegative whole simulation day.')
      setResult(await scoreScenario({ transaction_id: row.transaction_id, step: day, merchant: row.merchant, category, amount: value }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not score this scenario.') }
    finally { setBusy(false) }
  }
  return <section className="what-if"><h3>What if this changed?</h3><p>Try an amount, simulation day, or category change. The original transaction remains untouched.</p><div className="what-if-inputs"><label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label><label>Simulation day<input type="number" min="0" step="1" value={step} onChange={event => setStep(event.target.value)} /></label><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value} value={value}>{value.replace(/^es_/, '')}</option>)}</select></label></div><button className="secondary-button" onClick={() => void run()} disabled={busy}>{busy ? 'Scoring…' : 'Score scenario'}</button>{error && <p role="alert" className="case-error">{error}</p>}{result && <><div className="scenario-result"><span>Original <strong>{pct(row.risk_score)}</strong></span><span>Hypothetical <strong>{pct(result.risk_score)}</strong></span><em>{result.would_alert ? 'Would alert at the saved threshold' : 'Would not alert at the saved threshold'}</em></div><h4 className="scenario-reasons-title">Hypothetical model factors</h4><ReasonBars explanation={result} /></>}</section>
}
