import type { Explanation } from '../lib/api'

export default function ReasonBars({ explanation }: { explanation: Explanation }) {
  const max = Math.max(...explanation.factors.map(item => Math.abs(item.contribution)), 0.01)
  return <div className="reasons">
    {explanation.factors.map(item => <div className="reason-row" key={item.factor}>
      <div className="reason-label"><strong>{item.factor}</strong><span>{item.contribution >= 0 ? 'Raises score' : 'Lowers score'}</span></div>
      <div className="reason-track"><div className={item.contribution >= 0 ? 'positive' : 'negative'} style={{ width: `${Math.max(3, Math.abs(item.contribution) / max * 100)}%` }} /></div>
      <b className={item.contribution >= 0 ? 'positive-text' : 'negative-text'}>{item.contribution >= 0 ? '+' : ''}{item.contribution.toFixed(2)}</b>
    </div>)}
    <p className="reason-disclaimer">{explanation.interpretation}</p>
  </div>
}
