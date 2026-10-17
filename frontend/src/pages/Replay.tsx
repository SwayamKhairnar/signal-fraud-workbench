import { useEffect, useMemo, useState } from 'react'
import type { Batch } from '../lib/api'
import { replayOrder, replayTotals } from '../lib/replay'

const whole = new Intl.NumberFormat('en')
const percent = (number: number) => `${(number * 100).toFixed(1)}%`

export default function Replay({ batch }: { batch: Batch }) {
  const ordered = useMemo(() => replayOrder(batch.rows), [batch])
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 5 | 20>(1)
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setCursor(current => Math.min(ordered.length, current + 10 * speed)), 200)
    return () => window.clearInterval(timer)
  }, [playing, speed, ordered.length])
  useEffect(() => { if (cursor >= ordered.length) setPlaying(false) }, [cursor, ordered.length])
  const shown = ordered.slice(0, cursor)
  const totals = replayTotals(shown, batch.default_threshold)
  const recent = shown.slice(-7).reverse()
  const final = replayTotals(ordered, batch.default_threshold)
  const currentDay = cursor ? ordered[cursor - 1].step : ordered[0]?.step ?? 0
  return <main className="dashboard-main replay-main">
    <div className="dashboard-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> HISTORICAL PLAYBACK</p><h1>Transaction replay<span>.</span></h1><p>Watch this already-scored batch unfold in simulation order. Playback does not retrain or rescore the model.</p></div></div>
    <section className="replay-console"><div className="replay-top"><div><span className="replay-live-dot" /><strong>{playing ? 'Playing' : cursor === ordered.length ? 'Complete' : cursor ? 'Paused' : 'Ready to replay'}</strong><small>Simulation day {currentDay}</small></div><span>{whole.format(cursor)} / {whole.format(ordered.length)} transactions</span></div><div className="replay-progress"><div style={{ width: `${ordered.length ? cursor / ordered.length * 100 : 0}%` }} /></div><div className="replay-controls"><button className="primary-button" onClick={() => { if (cursor >= ordered.length) setCursor(0); setPlaying(value => !value) }}>{playing ? 'Pause' : cursor === ordered.length ? 'Play again' : cursor ? 'Resume' : 'Start replay'}</button><button className="secondary-button" onClick={() => { setPlaying(false); setCursor(0) }}>Restart</button><fieldset><legend>Speed</legend>{([1, 5, 20] as const).map(value => <button key={value} className={speed === value ? 'selected' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</fieldset></div></section>
    <section className="replay-metrics" aria-label="Running replay totals"><div><span>Processed</span><strong>{whole.format(totals.processed)}</strong></div><div><span>Alerts</span><strong>{whole.format(totals.alerts)}</strong></div>{batch.mode === 'evaluation' && <><div><span>Labeled fraud seen</span><strong>{whole.format(totals.labeledFraud)}</strong></div><div><span>Running precision</span><strong>{totals.alerts ? percent(totals.truePositive / totals.alerts) : '—'}</strong></div><div><span>Running recall</span><strong>{totals.labeledFraud ? percent(totals.truePositive / totals.labeledFraud) : '—'}</strong></div></>}</section>
    <section className="replay-feed"><div className="replay-feed-heading"><h2>Latest transactions</h2><span>Newest arrival first</span></div>{recent.length ? recent.map(row => <div className={`replay-feed-row ${row.risk_score >= batch.default_threshold ? 'flagged' : ''}`} key={row.transaction_id}><span className="feed-indicator" /><strong>{row.transaction_id}</strong><span>day {row.step}</span><span>{row.category.replace(/^es_/, '')}</span><b>{percent(row.risk_score)}</b><em>{row.risk_score >= batch.default_threshold ? 'Alert' : 'Scored'}</em></div>) : <p className="replay-feed-empty">Start playback to see transaction arrivals.</p>}</section>
    <p className="replay-footnote">At the end, replay should show {whole.format(final.processed)} processed and {whole.format(final.alerts)} alerts, matching the overview. {batch.mode === 'evaluation' ? 'Running precision and recall use only labels already reached in playback.' : 'This file has no labels, so running performance metrics are hidden.'}</p>
  </main>
}
