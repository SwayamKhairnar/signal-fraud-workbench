export type Transaction = {
  transaction_id: string
  step: number
  merchant: string
  category: string
  amount: number
  fraud?: 0 | 1
  risk_score: number
}

export type CleaningReport = {
  input_rows: number
  valid_rows: number
  dropped_rows: number
  duplicate_rows: number
  unknown_merchant_rows: number
  unknown_category_rows: number
  drop_reasons: Record<string, number>
  examples: { row: number; reason: string }[]
}

export type BatchEvaluation = {
  threshold: number
  precision: number
  recall: number
  f1: number
  average_precision: number | null
  roc_auc: number | null
  confusion: { tn: number; fp: number; fn: number; tp: number }
}

export type Batch = {
  batch_hash: string
  mode: 'scoring' | 'evaluation'
  schema_version: string
  model_version: string
  selected_model: string
  default_threshold: number
  alert_count: number
  cleaning: CleaningReport
  eda: {
    total_amount: number
    median_amount: number
    category_counts: { category: string; count: number }[]
    amount_distribution: { from: number; to: number; count: number }[]
    score_distribution: { from: number; to: number; count: number }[]
    step_activity: { from_step: number; to_step: number; count: number }[]
    fraud_count?: number
    fraud_rate?: number
  }
  rows: Transaction[]
  evaluation?: BatchEvaluation
}

export type Meta = {
  schema_version: string
  required_columns: string[]
  optional_columns: string[]
  max_bytes: number
  max_rows: number
  known_categories: string[]
  selected_model: string
  model_version: string
  default_threshold: number
  score_meaning: string
}

export type Explanation = {
  transaction_id: string
  risk_score: number
  baseline_log_odds: number
  raw_log_odds: number
  factors: { factor: string; contribution: number }[]
  unit: string
  interpretation: string
  model_version: string
}

export type ModelLab = {
  artifact_version: string
  selected_model: string
  selection_rule: string
  test_period: { rows: number; fraud_rows: number; step_min: number; step_max: number }
  candidates: Record<string, {
    model_id: string; threshold_from_validation: number; rows: number; fraud_rows: number
    precision: number; recall: number; f1: number; average_precision: number; roc_auc: number
    alert_count: number; confusion: { tn: number; fp: number; fn: number; tp: number }
    roc_curve: { x: number; y: number }[]; pr_curve: { x: number; y: number }[]
  }>
  selected_model_global_importance: Record<string, number>
  importance_definition: string
}

export class ApiError extends Error {
  code: string
  details: Record<string, unknown>
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: string; message?: string; details?: Record<string, unknown> } | null
    throw new ApiError(payload?.code ?? 'request_failed', payload?.message ?? `Request failed (${response.status}).`, payload?.details ?? {})
  }
  return response.json() as Promise<T>
}

export async function getMeta(): Promise<Meta> {
  return parseResponse<Meta>(await fetch('/api/meta'))
}

export async function scoreFile(file: File): Promise<Batch> {
  const form = new FormData()
  form.append('file', file)
  return parseResponse<Batch>(await fetch('/api/batches/score', { method: 'POST', body: form }))
}

export async function scoreDemo(): Promise<Batch> {
  const response = await fetch('/api/demo.csv')
  if (!response.ok) throw new ApiError('demo_unavailable', 'The sample batch could not be loaded.')
  const file = new File([await response.blob()], 'banksim_demo.csv', { type: 'text/csv' })
  return scoreFile(file)
}

export async function explainTransaction(row: Transaction): Promise<Explanation> {
  const { transaction_id, step, merchant, category, amount } = row
  return parseResponse<Explanation>(await fetch('/api/explain', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id, step, merchant, category, amount }),
  }))
}

export async function getModelLab(): Promise<ModelLab> {
  return parseResponse<ModelLab>(await fetch('/api/model-lab'))
}

export type Scenario = Explanation & { scenario: 'hypothetical'; threshold: number; would_alert: boolean }

export async function scoreScenario(row: Pick<Transaction, 'transaction_id' | 'step' | 'merchant' | 'category' | 'amount'>): Promise<Scenario> {
  return parseResponse<Scenario>(await fetch('/api/what-if', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row),
  }))
}
