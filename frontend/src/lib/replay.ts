import type { Transaction } from './api'

export function replayOrder(rows: Transaction[]): Transaction[] {
  return rows.map((row, index) => ({ row, index })).sort((a, b) => a.row.step - b.row.step || a.index - b.index).map(item => item.row)
}

export function replayTotals(rows: Transaction[], threshold: number) {
  let alerts = 0, labeledFraud = 0, truePositive = 0, falsePositive = 0
  for (const row of rows) {
    const flagged = row.risk_score >= threshold
    alerts += Number(flagged)
    if (row.fraud !== undefined) {
      labeledFraud += row.fraud
      truePositive += Number(flagged && row.fraud === 1)
      falsePositive += Number(flagged && row.fraud === 0)
    }
  }
  return { processed: rows.length, alerts, labeledFraud, truePositive, falsePositive }
}
