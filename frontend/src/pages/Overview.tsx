import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartPanel from '../components/ChartPanel'
import MetricCard from '../components/MetricCard'
import type { Batch } from '../lib/api'
import { loadReviews } from '../lib/reviews'

type Props = { batch: Batch; onNewBatch: () => void }

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en')

function categoryName(value: string): string {
  return value.replace(/^es_/, '').replace(/and/g, ' & ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase())
}

export default function Overview({ batch, onNewBatch }: Props) {
  const categoryData = batch.eda.category_counts.slice(0, 7).map(item => ({ name: categoryName(item.category), count: item.count }))
  const amountData = batch.eda.amount_distribution.map(item => ({ label: compact.format(item.to), count: item.count }))
  const activityData = batch.eda.step_activity.map(item => ({ day: item.from_step === item.to_step ? `${item.from_step}` : `${item.from_step}–${item.to_step}`, count: item.count }))
  const scoreData = batch.eda.score_distribution.map(item => ({ label: `${Math.round(item.to * 100)}`, count: item.count }))
  const firstStep = batch.rows.reduce((min, row) => Math.min(min, row.step), Infinity)
  const lastStep = batch.rows.reduce((max, row) => Math.max(max, row.step), -Infinity)
  const qualityItems = [
    { label: 'Rows received', value: whole.format(batch.cleaning.input_rows) },
    { label: 'Valid rows', value: whole.format(batch.cleaning.valid_rows) },
    { label: 'Dropped rows', value: whole.format(batch.cleaning.dropped_rows) },
    { label: 'Duplicates removed', value: whole.format(batch.cleaning.duplicate_rows) },
    { label: 'Unseen merchants', value: whole.format(batch.cleaning.unknown_merchant_rows) },
    { label: 'Unseen categories', value: whole.format(batch.cleaning.unknown_category_rows) },
  ]

  return <main className="dashboard-main">
    <div className="dashboard-heading">
      <div><p className="eyebrow"><span className="eyebrow-line" /> BATCH INTELLIGENCE</p><h1>Transaction overview<span>.</span></h1><p>A clear first look at volume, alert workload, and the patterns inside this batch.</p></div>
      <div className="overview-actions"><button className="secondary-button" onClick={() => void import('../lib/report').then(module => module.downloadBatchReport(batch, loadReviews(batch.batch_hash, batch.model_version)))}>↓ Download report</button><button className="secondary-button" onClick={onNewBatch}>↑ New batch</button></div>
    </div>
    <div className="batch-context"><span className="context-pill"><span className="context-dot" /> {batch.mode === 'evaluation' ? 'Labeled evaluation batch' : 'Unlabeled scoring batch'}</span><span>Simulation days {firstStep}–{lastStep}</span><span>Model {batch.selected_model} · {batch.model_version}</span></div>

    <section className="metrics-grid" aria-label="Batch summary">
      <MetricCard label="VALID TRANSACTIONS" value={whole.format(batch.cleaning.valid_rows)} detail="Rows scored after validation and cleaning." />
      <MetricCard label="FLAGGED FOR REVIEW" value={whole.format(batch.alert_count)} detail={`Model scores at or above the ${Math.round(batch.default_threshold * 100)}% threshold.`} accent="coral" />
      <MetricCard label="MEDIAN AMOUNT" value={compact.format(batch.eda.median_amount)} detail="Middle transaction amount in simulator units." />
      {batch.mode === 'evaluation' ? <MetricCard label="LABELED FRAUD" value={whole.format(batch.eda.fraud_count ?? 0)} detail="Known fraud labels supplied in this CSV." accent="coral" /> : <MetricCard label="SIMULATION WINDOW" value={`${lastStep - firstStep + 1} days`} detail="Range of synthetic simulation days in this batch." />}
    </section>

    <div className="insight-row">
      <div className="insight-icon" aria-hidden="true">✦</div>
      <div><strong>{batch.mode === 'evaluation' ? 'Evaluation mode is on' : 'Scoring mode is on'}</strong><p>{batch.mode === 'evaluation' ? `${((batch.eda.fraud_rate ?? 0) * 100).toFixed(2)}% of valid rows are labeled fraud; the remaining ${((1 - (batch.eda.fraud_rate ?? 0)) * 100).toFixed(2)}% are labeled legitimate. The Model Lab shows measured outcomes.` : 'This file has no fraud labels. Scores and alerts are predictions; performance metrics are unavailable for this batch.'}</p></div>
    </div>

    <section className="charts-grid" aria-label="Batch patterns">
      <ChartPanel title="Activity through time" description="Number of payments by simulation day or day group" className="wide">
        <ResponsiveContainer width="100%" height={245}><AreaChart data={activityData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#479284" stopOpacity={0.28} /><stop offset="100%" stopColor="#479284" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf1ec" /><XAxis dataKey="day" tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={32} /><YAxis tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={value => compact.format(value)} /><Tooltip formatter={(value) => [whole.format(Number(value)), 'Transactions']} labelFormatter={label => `Simulation day ${label}`} /><Area type="monotone" dataKey="count" stroke="#277c70" strokeWidth={2.5} fill="url(#activityFill)" /></AreaChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Transaction categories" description="Most common purchase categories in this batch">
        <ResponsiveContainer width="100%" height={245}><BarChart data={categoryData} layout="vertical" margin={{ top: 2, right: 18, left: 8, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#edf1ec" /><XAxis type="number" tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={value => compact.format(value)} /><YAxis type="category" dataKey="name" width={105} tick={{ fill: '#72867d', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [whole.format(Number(value)), 'Transactions']} /><Bar dataKey="count" radius={[0, 5, 5, 0]} fill="#2b8275" /></BarChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Amount distribution" description="Log-spaced amount bands; labels show simulator units">
        <ResponsiveContainer width="100%" height={245}><BarChart data={amountData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf1ec" /><XAxis dataKey="label" tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={25} /><YAxis tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={value => compact.format(value)} /><Tooltip formatter={(value) => [whole.format(Number(value)), 'Transactions']} /><Bar dataKey="count" fill="#aac9bb" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Model score spread" description="How the saved model ranked transactions from lower to higher risk">
        <ResponsiveContainer width="100%" height={245}><BarChart data={scoreData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf1ec" /><XAxis dataKey="label" tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={25} /><YAxis tick={{ fill: '#92a39a', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={value => compact.format(value)} /><Tooltip formatter={(value) => [whole.format(Number(value)), 'Transactions']} labelFormatter={label => `Score band up to ${label}%`} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{scoreData.map((_, index) => <Cell key={index} fill={index > scoreData.length * 0.7 ? '#eb8b75' : '#a4c7b8'} />)}</Bar></BarChart></ResponsiveContainer>
      </ChartPanel>
    </section>

    <section className="quality-panel"><div><p className="section-kicker">DATA QUALITY</p><h2>What happened to your file</h2><p>Every row is accounted for before scoring. Unknown merchant or category codes are mapped to a safe placeholder.</p></div><div className="quality-grid">{qualityItems.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></section>
  </main>
}
