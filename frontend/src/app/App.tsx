import { useEffect, useState } from 'react'
import Intake from '../pages/Intake'
import Overview from '../pages/Overview'
import Alerts from '../pages/Alerts'
import ModelLab from '../pages/ModelLab'
import Replay from '../pages/Replay'
import ErrorAnalysis from '../pages/ErrorAnalysis'
import { ApiError, getMeta, getModelLab, getValidationAnalysis, scoreDemo, scoreFile, type Batch, type Meta, type ModelLab as ModelLabData, type ValidationAnalysis } from '../lib/api'
import { getHealth, type Health } from '../lib/health'

type ServiceState =
  | { kind: 'checking' }
  | { kind: 'ready'; health: Health }
  | { kind: 'offline' }

type View = 'overview' | 'alerts' | 'lab' | 'analysis' | 'replay'
const GUIDE: { view: View; title: string; detail: string; next: string }[] = [
  { view: 'overview', title: 'Start with the batch', detail: 'Show the 2,000 scored payments, 20 supplied labels, and 16 default alerts.', next: 'Review alerts' },
  { view: 'alerts', title: 'Review before revealing', detail: 'Open an alert, inspect its model factors, and make a blind analyst decision.', next: 'Examine blind spots' },
  { view: 'analysis', title: 'Show where the model fails', detail: 'Use validation slices to explain low-amount misses and the workload tradeoff.', next: 'Compare models' },
  { view: 'lab', title: 'Explain the evidence', detail: 'Separate the fixed final test from the current demo batch and discuss precision and recall.', next: 'Watch replay' },
  { view: 'replay', title: 'Finish with playback', detail: 'Play already-scored transactions through simulation time. This is not live streaming.', next: 'Finish guide' },
]

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const missing = error.details.missing
    const unsupported = error.details.unsupported
    const extra = [
      Array.isArray(missing) && missing.length ? `Missing: ${missing.join(', ')}.` : '',
      Array.isArray(unsupported) && unsupported.length ? `Unsupported: ${unsupported.join(', ')}.` : '',
    ].filter(Boolean).join(' ')
    return `${error.message}${extra ? ` ${extra}` : ''}`
  }
  return error instanceof Error ? error.message : 'Something went wrong while reading the batch.'
}

export default function App() {
  const [service, setService] = useState<ServiceState>({ kind: 'checking' })
  const [meta, setMeta] = useState<Meta | null>(null)
  const [lab, setLab] = useState<ModelLabData | null>(null)
  const [analysis, setAnalysis] = useState<ValidationAnalysis | null>(null)
  const [metaError, setMetaError] = useState(false)
  const [labError, setLabError] = useState(false)
  const [analysisError, setAnalysisError] = useState(false)
  const [batch, setBatch] = useState<Batch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('overview')
  const [guided, setGuided] = useState(false)
  const [demoSample, setDemoSample] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('signal-theme') === 'dark')

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('signal-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    let active = true
    getHealth().then(health => active && setService({ kind: 'ready', health })).catch(() => active && setService({ kind: 'offline' }))
    getMeta().then(data => { if (active) setMeta(data) }).catch(() => { if (active) setMetaError(true) })
    getModelLab().then(data => { if (active) setLab(data) }).catch(() => { if (active) setLabError(true) })
    getValidationAnalysis().then(data => { if (active) setAnalysis(data) }).catch(() => { if (active) setAnalysisError(true) })
    return () => { active = false }
  }, [])

  function retryResources() {
    setMetaError(false)
    setLabError(false)
    setAnalysisError(false)
    setService({ kind: 'checking' })
    getHealth().then(health => setService({ kind: 'ready', health })).catch(() => setService({ kind: 'offline' }))
    getMeta().then(setMeta).catch(() => setMetaError(true))
    getModelLab().then(setLab).catch(() => setLabError(true))
    getValidationAnalysis().then(setAnalysis).catch(() => setAnalysisError(true))
  }

  async function load(action: () => Promise<Batch>, sample = false) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      setBatch(result)
      setDemoSample(sample)
      setGuided(sample)
      setView('overview')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const stateLabel = service.kind === 'ready'
    ? metaError || labError || analysisError ? 'Some features unavailable' : 'Service connected'
    : service.kind === 'checking' ? 'Checking service' : 'Service unavailable'
  const merchants = meta?.known_merchants ?? []
  const guideIndex = GUIDE.findIndex(item => item.view === view)

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={() => { setBatch(null); setError(null); setGuided(false) }} aria-label="Signal home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>signal<span className="brand-period">.</span></span>
        </button>
        <div className="topbar-right">
          {batch && (
            <nav className="top-nav" aria-label="Workbench">
              <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>Overview</button>
              <button className={view === 'alerts' ? 'active' : ''} onClick={() => setView('alerts')}>Alerts</button>
              <button className={view === 'lab' ? 'active' : ''} onClick={() => setView('lab')}>Model Lab</button>
              <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}>Blind Spots</button>
              <button className={view === 'replay' ? 'active' : ''} onClick={() => setView('replay')}>Replay</button>
            </nav>
          )}
          {!batch && <span className="prototype-label">ANALYST WORKBENCH / PROTOTYPE</span>}

          {/* Dark mode toggle */}
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(d => !d)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? '☀︎' : '☽'}
          </button>

          <span className={`service-status ${service.kind}`} role="status">
            <span className="status-dot" />{stateLabel}
          </span>
          {batch && demoSample && !guided && <button className="resource-retry" onClick={() => { setView('overview'); setGuided(true) }}>Demo guide</button>}
          {(service.kind === 'offline' || metaError || labError || analysisError) && <button className="resource-retry" onClick={retryResources}>Retry connection</button>}
        </div>
      </header>

      {batch && guided && guideIndex >= 0 && <section className="demo-guide" aria-label="Guided sample walkthrough">
        <span>DEMO GUIDE · {guideIndex + 1} OF {GUIDE.length}</span>
        <div><strong>{GUIDE[guideIndex].title}</strong><p>{GUIDE[guideIndex].detail}</p></div>
        <button className="demo-guide-next" onClick={() => { if (guideIndex < GUIDE.length - 1) setView(GUIDE[guideIndex + 1].view); else setGuided(false) }}>{GUIDE[guideIndex].next} →</button>
        <button className="demo-guide-skip" onClick={() => setGuided(false)} aria-label="Skip demo guide">×</button>
      </section>}

      {batch
        ? view === 'overview'
          ? <Overview batch={batch} onNewBatch={() => { setBatch(null); setError(null); setGuided(false) }} />
          : view === 'alerts'
            ? <Alerts batch={batch} merchants={merchants} />
            : view === 'analysis'
              ? analysis
                ? <ErrorAnalysis analysis={analysis} />
                : <main className="dashboard-main"><p role={analysisError ? 'alert' : 'status'}>{analysisError ? 'Validation analysis is unavailable right now.' : 'Loading validation analysis…'}</p>{analysisError && <button className="secondary-button" onClick={retryResources}>Retry validation analysis</button>}</main>
            : view === 'replay'
              ? <Replay batch={batch} />
              : lab
                ? <ModelLab lab={lab} batch={batch} />
              : <main className="dashboard-main"><p role={labError ? 'alert' : 'status'}>{labError ? 'Model evidence is unavailable right now.' : 'Loading model evidence…'}</p>{labError && <button className="secondary-button" onClick={retryResources}>Retry model evidence</button>}</main>
        : <Intake meta={meta} busy={busy} error={error} metaError={metaError} onRetry={retryResources} onDemo={() => void load(scoreDemo, true)} onFile={file => void load(() => scoreFile(file))} />
      }

      <footer>
        <span>Signal · Banking fraud decision-support prototype</span>
        <span>Synthetic data only · Built for an AIML demonstration</span>
      </footer>
    </div>
  )
}
