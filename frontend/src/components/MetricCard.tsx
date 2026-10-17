import { motion } from 'framer-motion'

type Props = { label: string; value: string; detail: string; accent?: 'coral' | 'teal' }

export default function MetricCard({ label, value, detail, accent = 'teal' }: Props) {
  return <motion.article className={`metric-card ${accent}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
    <div className="metric-top"><span>{label}</span><span className="metric-mark" aria-hidden="true">↗</span></div>
    <strong>{value}</strong>
    <p>{detail}</p>
  </motion.article>
}
