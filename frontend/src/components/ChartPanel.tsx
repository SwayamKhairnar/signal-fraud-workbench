import type { ReactNode } from 'react'

type Props = { title: string; description: string; children: ReactNode; className?: string }

export default function ChartPanel({ title, description, children, className = '' }: Props) {
  return <section className={`chart-panel ${className}`}>
    <div className="chart-heading"><div><h3>{title}</h3><p>{description}</p></div></div>
    <div className="chart-content">{children}</div>
  </section>
}
