import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ValidationAnalysis } from '../lib/api'

const whole = new Intl.NumberFormat('en')
const pct = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`
const categoryName = (name: string) => name.replace(/^es_/, '').replaceAll('and', ' & ').replace(/([a-z])([A-Z])/g, '$1 $2')

export default function ErrorAnalysis({ analysis }: { analysis: ValidationAnalysis }) {
  const [slice, setSlice] = useState<'amount' | 'category' | 'period'>('amount')
  const [selected, setSelected] = useState<string | null>(null)
  const groups = slice === 'amount' ? analysis.by_amount : slice === 'category' ? analysis.by_category.filter(group => group.fraud > 0) : analysis.by_period
  const chosen = groups.find(group => group.name === selected) ?? groups[0]
  const chart = groups.map(group => ({ name: slice === 'category' ? categoryName(group.name) : group.name.replace(' units', ''), recall: (group.recall ?? 0) * 100, fraud: group.fraud }))
  const lowAmount = analysis.by_amount.slice(0, -1).reduce((totals, group) => ({ fraud: totals.fraud + group.fraud, tp: totals.tp + group.tp }), { fraud: 0, tp: 0 })

  return (
    <main className="dashboard-main analysis-main">
      <div className="dashboard-heading"><div>
        <p className="eyebrow"><span className="eyebrow-line" /> VALIDATION ERROR ANALYSIS</p>
        <h1>Where the model struggles<span>.</span></h1>
        <p>Explore missed frauds in the earlier validation period. These figures do not use the final test set or the current upload.</p>
      </div></div>

      <div className="lab-note"><strong>Validation period · days 108–143</strong><span>{whole.format(analysis.overall.rows)} synthetic transactions · {whole.format(analysis.overall.fraud)} labeled frauds · model {analysis.artifact_version}</span><p>All slices use the saved {pct(analysis.threshold)} threshold. Small groups can vary sharply; these are measurements on BankSim, not real bank forecasts.</p></div>

      <section className="analysis-insight">
        <span>THE MAIN BLIND SPOT</span>
        <h2>Low amount fraud is easier to miss.</h2>
        <p>Across the lower four amount bands, the model caught <strong>{lowAmount.tp} of {lowAmount.fraud}</strong> labeled frauds ({pct(lowAmount.tp / lowAmount.fraud)} recall). The highest amount band reached <strong>{pct(analysis.by_amount.at(-1)?.recall ?? null)}</strong> recall. This motivates a future model with past-only customer behaviour.</p>
      </section>

      <section className="lab-section">
        <div className="lab-section-heading"><h2>The review workload tradeoff</h2><p>More reviewed alerts catch more labeled frauds, but also use more analyst time. Points come from validation scores only.</p></div>
        <div className="workload-summary"><strong>{whole.format(analysis.overall.alerts)}</strong> alerts at the saved threshold <span>→</span> <strong>{whole.format(analysis.overall.tp)}</strong> frauds caught <span>·</span> <strong>{whole.format(analysis.overall.fp)}</strong> false alarms</div>
        <div className="analysis-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analysis.workload} margin={{ left: 10, right: 20, bottom: 16 }}>
              <CartesianGrid stroke="#e7ede9" />
              <XAxis dataKey="alerts" type="number" domain={[0, 'dataMax']} tickFormatter={value => whole.format(value)} label={{ value: 'Alerts reviewed', position: 'insideBottom', offset: -8 }} />
              <YAxis dataKey="tp" type="number" domain={[0, analysis.overall.fraud]} label={{ value: 'Frauds caught', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value, name) => [whole.format(Number(value)), name === 'tp' ? 'Frauds caught' : String(name)]} labelFormatter={value => `${whole.format(Number(value))} alerts reviewed`} />
              <ReferenceLine x={analysis.overall.alerts} stroke="#df826d" strokeDasharray="5 4" label={{ value: 'Saved threshold', position: 'top', fontSize: 10 }} />
              <Line type="linear" dataKey="tp" dot stroke="#2b8275" strokeWidth={3} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="analysis-footnote">The curve is retrospective on synthetic validation labels. A future batch may have a different fraud rate and error pattern.</p>
      </section>

      <section className="lab-section">
        <div className="lab-section-heading"><h2>Recall by segment</h2><p>Choose a slice, then select a bar for its exact counts. Categories with no labeled fraud are omitted because recall is undefined.</p></div>
        <div className="analysis-tabs" role="group" aria-label="Error analysis slices">
          {(['amount', 'category', 'period'] as const).map(value => <button key={value} className={slice === value ? 'active' : ''} onClick={() => { setSlice(value); setSelected(null) }}>{value === 'amount' ? 'Amount bands' : value === 'category' ? 'Categories' : 'Time periods'}</button>)}
        </div>
        <div className="analysis-chart">
          <ResponsiveContainer width="100%" height={Math.max(260, chart.length * 32)}>
            <BarChart data={chart} layout="vertical" margin={{ left: 16, right: 32 }}>
              <CartesianGrid horizontal={false} stroke="#e7ede9" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={value => `${value}%`} />
              <YAxis type="category" dataKey="name" width={slice === 'category' ? 145 : 130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={value => [`${Number(value).toFixed(1)}%`, 'Recall']} />
              <Bar dataKey="recall" radius={[0, 5, 5, 0]} onClick={(_, index) => setSelected(groups[index]?.name ?? null)}>
                {chart.map((group, index) => <Cell key={group.name} fill={groups[index]?.name === chosen?.name ? '#df826d' : '#3f9481'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {chosen && <div className="analysis-detail" aria-live="polite">
          <h3>{slice === 'category' ? categoryName(chosen.name) : chosen.name}</h3>
          <div><span>{whole.format(chosen.rows)} payments</span><span>{whole.format(chosen.fraud)} known frauds</span><span>{whole.format(chosen.tp)} caught</span><span>{whole.format(chosen.fn)} missed</span><span>{whole.format(chosen.fp)} false alarms</span></div>
          <p>Recall {pct(chosen.recall)} · Precision {pct(chosen.precision)}{chosen.fraud < 30 ? ' · Small fraud count: interpret cautiously.' : ''}</p>
        </div>}
      </section>

      <section className="lab-section">
        <div className="lab-section-heading"><h2>Near-threshold missed examples</h2><p>These labeled frauds fell just below the saved alert threshold in validation. They illustrate errors, not future predictions.</p></div>
        <div className="missed-grid">{analysis.missed_examples.map((example, index) => <div key={index}><strong>{categoryName(example.category)}</strong><span>{example.amount.toFixed(2)} simulator units · day {example.step}</span><b>Model score {pct(example.score)}</b></div>)}</div>
      </section>
      <p className="analysis-footnote">{analysis.notes}</p>
    </main>
  )
}
