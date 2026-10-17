import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import ChartPanel from '../components/ChartPanel'
import type { Batch, ModelLab as ModelLabData } from '../lib/api'
import { rankingCurves } from '../lib/metrics'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const whole = new Intl.NumberFormat('en')

const definitions = [
  ['Precision', 'Of flagged transactions, the share labeled fraud.'],
  ['Recall', 'Of labeled fraud transactions, the share flagged.'],
  ['F1', 'Balance of precision and recall at the chosen threshold.'],
  ['Average precision', 'Area under the precision–recall ranking curve; useful when fraud is rare.'],
  ['ROC AUC', 'Ranking separation across false-positive and true-positive rates.'],
]

// ── Animated count-up hook ──────────────────────────────────────────────────
function useCountUp(target: number, duration = 900, reducedMotion = false) {
  const [value, setValue] = useState(reducedMotion ? target : 0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (reducedMotion) { setValue(target); return }
    const start = performance.now()
    const from = 0
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, reducedMotion])

  return value
}

// ── Animated confusion cell ──────────────────────────────────────────────────
function ConfusionCell({ label, value, reducedMotion }: { label: string; value: number; reducedMotion: boolean }) {
  const animated = useCountUp(value, 1200, reducedMotion)
  return (
    <div>
      <span>{label}</span>
      <strong>{whole.format(animated)}</strong>
    </div>
  )
}

export default function ModelLab({ lab, batch }: { lab: ModelLabData; batch: Batch }) {
  const reducedMotion = useReducedMotion() ?? false
  const selected = lab.candidates[lab.selected_model]
  const importance = Object.entries(lab.selected_model_global_importance)
    .sort((a, b) => b[1] - a[1])
    .map(([factor, value]) => ({ factor, value }))
  const roc = selected.roc_curve.map(point => ({ falsePositiveRate: point.x, truePositiveRate: point.y }))
  const pr = selected.pr_curve.map(point => ({ recall: point.x, precision: point.y }))
  const currentCurves = batch.mode === 'evaluation' ? rankingCurves(batch.rows) : null

  // Prevalence for the fixed test set — used as reference line on PR chart
  const testPrevalence = selected.fraud_rows / selected.rows

  return (
    <main className="dashboard-main lab-main">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> MODEL EVIDENCE</p>
          <h1>Model lab<span>.</span></h1>
          <p>Offline test performance and this batch's measured outcomes, kept in separate views.</p>
        </div>
      </div>

      <div className="lab-note">
        <strong>Fixed, untouched test period</strong>
        <span>BankSim simulation days {lab.test_period.step_min}–{lab.test_period.step_max} · {whole.format(lab.test_period.rows)} rows · {whole.format(lab.test_period.fraud_rows)} labeled fraud</span>
        <p>Models were selected and thresholds set using the earlier validation period. These test results were evaluated once.</p>
      </div>

      {/* ── Candidate comparison ────────────────────────────────────── */}
      <section className="lab-section">
        <div className="lab-section-heading">
          <h2>Candidate comparison</h2>
          <p>Chosen model: {lab.selected_model} · {lab.artifact_version}</p>
        </div>
        <div className="candidate-grid">
          {Object.values(lab.candidates).map(model => (
            <article className={`candidate-card ${model.model_id === lab.selected_model ? 'chosen' : ''}`} key={model.model_id}>
              <div className="candidate-heading">
                <h3>{model.model_id === 'lightgbm' ? 'LightGBM' : 'Logistic regression'}</h3>
                {model.model_id === lab.selected_model && <span>Selected</span>}
              </div>
              <strong>{pct(model.average_precision)}</strong>
              <small>Average precision on fixed test</small>
              <dl>
                <div><dt>Precision</dt><dd>{pct(model.precision)}</dd></div>
                <div><dt>Recall</dt><dd>{pct(model.recall)}</dd></div>
                <div><dt>F1</dt><dd>{pct(model.f1)}</dd></div>
                <div><dt>ROC AUC</dt><dd>{pct(model.roc_auc)}</dd></div>
                <div><dt>Alerts</dt><dd>{whole.format(model.alert_count)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <p className="lab-selection">Selection rule: {lab.selection_rule}</p>
      </section>

      {/* ── Selected model charts ───────────────────────────────────── */}
      <section className="lab-section">
        <div className="lab-section-heading">
          <h2>Selected model on fixed test</h2>
          <p>These charts use the entire final test period, not the currently uploaded file.</p>
        </div>
        <div className="charts-grid">

          {/* PR curve — with prevalence reference line [F9 from analysis] */}
          <ChartPanel
            title="Precision–recall curve"
            description={`Higher precision at the same recall means fewer false alerts. Dashed line = random classifier baseline (prevalence ${pct(testPrevalence)})`}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={pr}>
                <CartesianGrid stroke="#edf1ec" />
                <XAxis dataKey="recall" type="number" domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} label={{ value: 'Recall', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                <Tooltip formatter={value => pct(Number(value))} />
                {/* Prevalence reference line — a random classifier would sit here */}
                <ReferenceLine
                  y={testPrevalence}
                  stroke="#e8a06e"
                  strokeDasharray="5 4"
                  label={{ value: `Random (${pct(testPrevalence)})`, position: 'insideTopRight', fontSize: 9, fill: '#c08050' }}
                />
                <Line type="monotone" dataKey="precision" dot={false} stroke="#2b8275" strokeWidth={2.5} isAnimationActive={!reducedMotion} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* ROC curve */}
          <ChartPanel title="ROC curve" description="True-positive rate against false-positive rate">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={roc}>
                <CartesianGrid stroke="#edf1ec" />
                <XAxis dataKey="falsePositiveRate" type="number" domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                <Tooltip formatter={value => pct(Number(value))} />
                <Legend />
                {/* Diagonal reference line = random classifier */}
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                  stroke="#c0bfbf"
                  strokeDasharray="5 4"
                />
                <Line type="monotone" dataKey="truePositiveRate" dot={false} stroke="#df826d" strokeWidth={2.5} isAnimationActive={!reducedMotion} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>

        {/* Animated confusion matrix — [F3 from analysis] */}
        <div className="confusion-grid">
          <ConfusionCell label="True negatives" value={selected.confusion.tn} reducedMotion={reducedMotion} />
          <ConfusionCell label="False positives" value={selected.confusion.fp} reducedMotion={reducedMotion} />
          <ConfusionCell label="False negatives" value={selected.confusion.fn} reducedMotion={reducedMotion} />
          <ConfusionCell label="True positives" value={selected.confusion.tp} reducedMotion={reducedMotion} />
        </div>
      </section>

      {/* ── Feature importance — animated bars [F7] ─────────────────── */}
      <section className="lab-section">
        <div className="lab-section-heading">
          <h2>What the selected model uses</h2>
          <p>{lab.importance_definition}</p>
        </div>
        <ChartPanel title="Global contribution magnitude" description="Mean absolute raw-score contribution by source feature">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={importance} layout="vertical" margin={{ left: 22, right: 22 }}>
              <CartesianGrid horizontal={false} stroke="#edf1ec" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="factor" width={125} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3f9481" radius={[0, 5, 5, 0]} isAnimationActive={!reducedMotion} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      {/* ── Current batch ───────────────────────────────────────────── */}
      <section className="lab-section current-batch">
        <div className="lab-section-heading">
          <h2>Current uploaded batch</h2>
          <p>{batch.mode === 'evaluation' ? `${whole.format(batch.cleaning.valid_rows)} labeled rows` : `${whole.format(batch.cleaning.valid_rows)} unlabeled rows`}</p>
        </div>

        {batch.evaluation ? (
          <>
            <div className="batch-metrics">
              {[
                ['Precision', batch.evaluation.precision],
                ['Recall', batch.evaluation.recall],
                ['F1', batch.evaluation.f1],
                ['Average precision', batch.evaluation.average_precision],
                ['ROC AUC', batch.evaluation.roc_auc],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span>{label}</span>
                  <strong>{value === null ? 'Unavailable' : pct(Number(value))}</strong>
                </div>
              ))}
            </div>
            <p className="lab-selection">
              At the saved default threshold of {pct(batch.default_threshold)}.{' '}
              {currentCurves ? `Fraud prevalence is ${pct(currentCurves.prevalence)}.` : 'A one-class batch has no defined ranking curve.'}
            </p>

            {currentCurves && (
              <div className="charts-grid current-curves">
                <ChartPanel
                  title="This batch: precision–recall"
                  description={`Computed from labels in the uploaded CSV. Dashed = random baseline (${pct(currentCurves.prevalence)})`}
                >
                  <ResponsiveContainer width="100%" height={225}>
                    <LineChart data={currentCurves.pr}>
                      <CartesianGrid stroke="#edf1ec" />
                      <XAxis dataKey="x" type="number" domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={value => pct(Number(value))} />
                      <ReferenceLine
                        y={currentCurves.prevalence}
                        stroke="#e8a06e"
                        strokeDasharray="5 4"
                        label={{ value: `Random`, position: 'insideTopRight', fontSize: 9, fill: '#c08050' }}
                      />
                      <Line type="monotone" dataKey="y" dot={false} stroke="#2b8275" strokeWidth={2.5} isAnimationActive={!reducedMotion} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>

                <ChartPanel title="This batch: ROC" description="Computed from labels in the uploaded CSV">
                  <ResponsiveContainer width="100%" height={225}>
                    <LineChart data={currentCurves.roc}>
                      <CartesianGrid stroke="#edf1ec" />
                      <XAxis dataKey="x" type="number" domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={value => pct(Number(value))} />
                      <ReferenceLine
                        segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                        stroke="#c0bfbf"
                        strokeDasharray="5 4"
                      />
                      <Line type="monotone" dataKey="y" dot={false} stroke="#df826d" strokeWidth={2.5} isAnimationActive={!reducedMotion} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>
              </div>
            )}
          </>
        ) : (
          <p className="lab-unavailable">
            No fraud labels were supplied, so measured performance is unavailable. The model can still rank and flag transactions.
          </p>
        )}
      </section>

      {/* ── Metric glossary ─────────────────────────────────────────── */}
      <section className="metric-glossary">
        <h2>How to read these metrics</h2>
        <div>
          {definitions.map(([name, description]) => (
            <p key={name}><strong>{name}</strong><span>{description}</span></p>
          ))}
        </div>
      </section>
    </main>
  )
}
