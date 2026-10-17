import type { Transaction } from './api'

export function thresholdMetrics(rows: Transaction[], threshold: number) {
  let tp = 0, fp = 0, fn = 0, tn = 0, alerts = 0
  for (const row of rows) {
    const flagged = row.risk_score >= threshold
    alerts += Number(flagged)
    if (row.fraud === undefined) continue
    if (flagged && row.fraud === 1) tp++
    else if (flagged) fp++
    else if (row.fraud === 1) fn++
    else tn++
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  return { alerts, confusion: { tp, fp, fn, tn }, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 }
}

export function rankingCurves(rows: Transaction[]) {
  const positives = rows.reduce((count, row) => count + Number(row.fraud === 1), 0)
  const negatives = rows.length - positives
  if (!positives || !negatives || rows.some(row => row.fraud === undefined)) return null
  const ordered = [...rows].sort((a, b) => b.risk_score - a.risk_score)
  const roc = [{ x: 0, y: 0 }]
  const pr = [{ x: 0, y: 1 }]
  let tp = 0, fp = 0
  for (let index = 0; index < ordered.length;) {
    const score = ordered[index].risk_score
    while (index < ordered.length && ordered[index].risk_score === score) {
      if (ordered[index].fraud === 1) tp++
      else fp++
      index++
    }
    roc.push({ x: fp / negatives, y: tp / positives })
    pr.push({ x: tp / positives, y: tp / (tp + fp) })
  }
  const sample = (points: { x: number; y: number }[]) => {
    const stride = Math.max(1, Math.ceil(points.length / 250))
    const reduced = points.filter((_, index) => index % stride === 0)
    if (reduced.at(-1) !== points.at(-1)) reduced.push(points.at(-1)!)
    return reduced
  }
  return { roc: sample(roc), pr: sample(pr), prevalence: positives / rows.length }
}
