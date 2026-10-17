import { useEffect, useState } from 'react'
import Intake from '../pages/Intake'
import Overview from '../pages/Overview'
import Alerts from '../pages/Alerts'
import ModelLab from '../pages/ModelLab'
import Replay from '../pages/Replay'
import { ApiError, getMeta, getModelLab, scoreDemo, scoreFile, type Batch, type Meta, type ModelLab as ModelLabData } from '../lib/api'
import { getHealth, type Health } from '../lib/health'

type ServiceState =
  | { kind: 'checking' }
  | { kind: 'ready'; health: Health }
  | { kind: 'offline' }

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
  const [batch, setBatch] = useState<Batch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'overview' | 'alerts' | 'lab' | 'replay'>('overview')

  useEffect(() => {
    let active = true
    getHealth().then(health => active && setService({ kind: 'ready', health })).catch(() => active && setService({ kind: 'offline' }))
    getMeta().then(data => active && setMeta(data)).catch(() => {})
    getModelLab().then(data => active && setLab(data)).catch(() => {})
    return () => { active = false }
  }, [])

  async function load(action: () => Promise<Batch>) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      setBatch(result)
      setView('overview')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const stateLabel = service.kind === 'ready' ? 'Service connected' : service.kind === 'checking' ? 'Checking service' : 'Service unavailable'

  return <div className="site-shell">
    <header className="topbar">
      <button className="brand brand-button" onClick={() => { setBatch(null); setError(null) }} aria-label="Signal home"><span className="brand-mark" aria-hidden="true"><span /></span><span>signal<span className="brand-period">.</span></span></button>
      <div className="topbar-right">
        {batch && <nav className="top-nav" aria-label="Workbench"><button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>Overview</button><button className={view === 'alerts' ? 'active' : ''} onClick={() => setView('alerts')}>Alerts</button><button className={view === 'lab' ? 'active' : ''} onClick={() => setView('lab')}>Model Lab</button><button className={view === 'replay' ? 'active' : ''} onClick={() => setView('replay')}>Replay</button></nav>}
        {!batch && <span className="prototype-label">ANALYST WORKBENCH / PROTOTYPE</span>}
        <span className={`service-status ${service.kind}`} role="status"><span className="status-dot" />{stateLabel}</span>
      </div>
    </header>

    {batch ? view === 'overview' ? <Overview batch={batch} onNewBatch={() => { setBatch(null); setError(null) }} /> : view === 'alerts' ? <Alerts batch={batch} /> : view === 'replay' ? <Replay batch={batch} /> : lab ? <ModelLab lab={lab} batch={batch} /> : <main className="dashboard-main"><p role="status">Loading model evidence…</p></main> : <Intake meta={meta} busy={busy} error={error} onDemo={() => void load(scoreDemo)} onFile={file => void load(() => scoreFile(file))} />}

    <footer><span>Signal · Banking fraud decision-support prototype</span><span>Synthetic data only · Built for an AIML demonstration</span></footer>
  </div>
}
