import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Meta } from '../lib/api'

type Props = {
  meta: Meta | null
  busy: boolean
  error: string | null
  onDemo: () => void
  onFile: (file: File) => void
}

export default function Intake({ meta, busy, error, onDemo, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const reducedMotion = useReducedMotion()

  function choose(file?: File) {
    if (file) onFile(file)
  }

  return <main>
    <section className="intake-hero" aria-labelledby="hero-title">
      <div className="intake-copy">
        <p className="eyebrow"><span className="eyebrow-line" /> FRAUD ANALYSIS, MADE CLEAR</p>
        <h1 id="hero-title">Find the signal.<br /><em>Understand</em> the risk.</h1>
        <p className="hero-description">Turn synthetic bank payments into a focused review. See which transactions need attention, why the model flagged them, and how each decision affects the bigger picture.</p>
        <div className="intake-badges"><span><b>01</b> Upload a batch</span><span><b>02</b> Review alerts</span><span><b>03</b> Explore the model</span></div>
      </div>
      <motion.div className="intake-card" initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.45 }}>
        <div className="intake-card-top"><span className="intake-card-icon" aria-hidden="true">↥</span><span>START AN ANALYSIS</span></div>
        <h2>Bring transactions<br />into focus.</h2>
        <p>Load the prepared sample for a full guided demo, or score your own BankSim-format CSV.</p>
        <button className="demo-button" onClick={onDemo} disabled={busy}>
          <span aria-hidden="true">✦</span>{busy ? 'Analyzing batch…' : 'Explore sample batch'}<span aria-hidden="true">↗</span>
        </button>
        <div className="divider-label"><span /> OR UPLOAD A CSV <span /></div>
        <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} hidden aria-label="Choose a transaction CSV" />
          <span className="upload-glyph" aria-hidden="true">↑</span>
          <strong>Drop your CSV here</strong>
          <span>or <button type="button" className="text-button" onClick={() => inputRef.current?.click()} disabled={busy}>browse files</button></span>
        </div>
        <div className="intake-card-footer"><span>CSV · up to {Math.round((meta?.max_bytes ?? 5 * 1024 * 1024) / (1024 * 1024))} MB · {(meta?.max_rows ?? 20000).toLocaleString()} rows</span><a href="/api/template.csv" download>Download template ↗</a></div>
        {error && <div className="upload-error" role="alert"><strong>Couldn’t process that file</strong><span>{error}</span></div>}
      </motion.div>
    </section>
    <section className="intake-notes">
      <div><span className="note-icon">✓</span><div><strong>Designed for review</strong><p>Scores highlight where a human analyst should look first.</p></div></div>
      <div><span className="note-icon">◇</span><div><strong>Clear model signals</strong><p>Reasons and metrics stay linked to the saved offline model.</p></div></div>
      <div><span className="note-icon">◷</span><div><strong>Replay-ready</strong><p>Watch an already-scored batch unfold in simulation time.</p></div></div>
    </section>
  </main>
}
