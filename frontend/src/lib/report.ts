import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Batch } from './api'
import type { Reviews } from './reviews'

const whole = new Intl.NumberFormat('en')
const pct = (value: number) => `${(value * 100).toFixed(1)}%`

type ReviewCounts = { needs_review: number; confirmed_fraud: number; false_alarm: number }

export async function createBatchReport(batch: Batch, fontBytes?: [Uint8Array, Uint8Array], reviewCounts: ReviewCounts = { needs_review: 0, confirmed_fraud: 0, false_alarm: 0 }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  pdf.registerFontkit(fontkit)
  const [regularBytes, boldBytes] = fontBytes ?? await Promise.all(['/fonts/LiberationSans-Regular.ttf', '/fonts/LiberationSans-Bold.ttf'].map(async path => {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Could not load report font ${path}`)
    return new Uint8Array(await response.arrayBuffer())
  })) as [Uint8Array, Uint8Array]
  const regular = await pdf.embedFont(regularBytes, { subset: true })
  const bold = await pdf.embedFont(boldBytes, { subset: true })
  const ink = rgb(.14, .31, .27), muted = rgb(.39, .53, .45), light = rgb(.96, .98, .96)
  const text = (value: string, x: number, top: number, size: number, isBold = false, color = ink) => page.drawText(value, { x, y: 841.89 - top - size, size, font: isBold ? bold : regular, color })
  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: light })
  page.drawRectangle({ x: 0, y: 717, width: 595.28, height: 125, color: rgb(.10, .25, .24) })
  text('signal.', 50, 46, 29, true, rgb(1, 1, 1))
  text('BATCH ANALYSIS REPORT', 50, 89, 11, false, rgb(.80, .89, .83))
  text('Transaction overview', 50, 149, 21, true)
  text(`Generated ${new Date().toLocaleDateString('en-IN')}  |  ${batch.mode === 'evaluation' ? 'Labeled evaluation batch' : 'Unlabeled scoring batch'}`, 50, 180, 10, false, muted)
  const metrics: [string, string][] = [
    ['Rows received', whole.format(batch.cleaning.input_rows)],
    ['Valid transactions', whole.format(batch.cleaning.valid_rows)],
    ['Dropped / duplicate', `${whole.format(batch.cleaning.dropped_rows)} / ${whole.format(batch.cleaning.duplicate_rows)}`],
    ['Flagged at saved threshold', whole.format(batch.alert_count)],
    ['Saved threshold', pct(batch.default_threshold)],
    ['Median amount', `${batch.eda.median_amount.toFixed(2)} simulator units`],
  ]
  let top = 216
  for (const [label, value] of metrics) {
    page.drawRectangle({ x: 50, y: 841.89 - top - 42, width: 495, height: 42, color: rgb(1, 1, 1), borderColor: rgb(.89, .93, .89), borderWidth: .4 })
    text(label, 64, top + 13, 10, false, muted)
    const size = 10
    text(value, 530 - bold.widthOfTextAtSize(value, size), top + 13, size, true)
    top += 49
  }
  text('Current batch evaluation', 50, 523, 15, true)
  if (batch.evaluation) {
    const value = batch.evaluation
    text(`Precision ${pct(value.precision)}   Recall ${pct(value.recall)}   F1 ${pct(value.f1)}`, 50, 553, 10, false, muted)
    text(`Average precision ${value.average_precision === null ? 'Unavailable (one class)' : pct(value.average_precision)}`, 50, 572, 10, false, muted)
    text(`TP ${value.confusion.tp}   FP ${value.confusion.fp}   FN ${value.confusion.fn}   TN ${value.confusion.tn}`, 50, 591, 10, false, muted)
  } else {
    text('No fraud labels supplied. Performance metrics are unavailable for this batch.', 50, 553, 10, false, muted)
  }
  text('Browser-local analyst reviews', 50, 624, 12, true)
  text(`Needs review ${reviewCounts.needs_review}   Confirmed fraud ${reviewCounts.confirmed_fraud}   False alarm ${reviewCounts.false_alarm}`, 50, 648, 9, false, muted)
  page.drawLine({ start: { x: 50, y: 166 }, end: { x: 545, y: 166 }, thickness: .7, color: rgb(.82, .89, .83) })
  text(`Model ${batch.selected_model}  |  Version ${batch.model_version}  |  Batch ${batch.batch_hash.slice(0, 16)}`, 50, 685, 8.5, false, muted)
  text('Source: BankSim synthetic bank payments, Kaggle ealaxi/banksim1; CC BY-NC-SA 4.0.', 50, 707, 8.5, false, muted)
  text('Scores are model rankings, not calibrated real-world fraud probabilities.', 50, 729, 8.5, false, muted)
  text('Decision support for a synthetic demonstration, not a live banking decision.', 50, 751, 8.5, false, muted)
  text('Signal  |  1 / 1', 485, 804, 8, false, muted)
  return pdf.save()
}

export async function downloadBatchReport(batch: Batch, reviews: Reviews) {
  const counts: ReviewCounts = { needs_review: 0, confirmed_fraud: 0, false_alarm: 0 }
  for (const status of Object.values(reviews)) if (status in counts) counts[status]++
  const bytes = await createBatchReport(batch, undefined, counts)
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `signal-batch-${batch.batch_hash.slice(0, 8)}.pdf`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
