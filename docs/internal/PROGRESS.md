# Project progress

## Current stage

Stage D: Phases 1-14 complete. Commit `09a8ee1` is live on the [Render service](https://signal-fraud-workbench.onrender.com/); the public sample scores 2,000 rows with 16 alerts and the explanation endpoint responds. Phases 15-19 are implemented locally and are undergoing final acceptance before the Phase 20 public deployment. The [implementation guide](IMPLEMENTATION_GUIDE.md) records each phase.

The project owner approved the final brief and BankSim, delegated technical choices, and asked the AI to evaluate each phase and continue without routine questions. The original brief's pause checkpoints are superseded by that request.

## Completed phases and evidence

| Phase | Result | Check |
|---|---|---|
| 1 | React/FastAPI walking skeleton | Browser showed service connected; build and health passed |
| 2 | BankSim source inspected and chronological split | 594,643 rows; split contract test |
| 3 | Logistic and LightGBM trained, validation selection, untouched final test | Saved manifest, model card, artifact reload tests |
| 4 | Bounded stateless upload, cleaning, scoring, EDA, model lab API | API contract tests and live local sample |
| 5 | Intake and overview | Original one-day sample loaded in browser; refreshed cross-period sample now has 2,000 scored and 16 alerts by API check |
| 6 | Alert queue, case detail, exact model contributions | Explanation reconstruction tests, including unknown values |
| 7 | Fixed-test Model Lab and separate current-batch metrics/curves | Frontend build; artifact data keys checked |
| 8 | Chronological replay with pause, restart, and 1x/5x/20x | Final replay totals checked against scoring result |
| 9 | Threshold tradeoff and browser-local review statuses | Client metrics checked against backend confusion and scores |
| 10 | What-if rescoring and PDF export | What-if API test; sample PDF generated, rendered, and inspected |
| 11 | Responsive and keyboard/reduced-motion CSS | Production build passes; visual browser recheck blocked by browser policy |
| 12 | Reliability and demo script | 13 backend tests pass; frontend build passes; 20k-row sample scored locally |
| 13 | Single-service package | Docker image built; health, frontend, sample scoring, explanations, and 20k-row upload verified locally at 512 MB / 0.1 CPU; public source repository pushed |
| 14 | Preserve newer visual baseline and deploy | Commit `09a8ee1` pushed; Render deploy succeeded; public sample and explanation API verified |
| 15 | Correctness and resilience | Local frontend build: stale scenarios/errors reset, queue bounded to 100 rows per page, retry states added; browser acceptance pending |
| 16 | Blind review | Local frontend build: source labels hidden until reveal, decision comparison separate from metrics; browser acceptance pending |
| 17 | Validation error analysis | 128,820-row validation artifact generated; 14 backend tests pass; frontend build passes; browser acceptance pending |
| 18 | Workload and illustrative cost | Validation workload chart and noncurrency penalty scenario implemented; build passes; browser acceptance pending |
| 19 | Contribution comparison and demo guide | Local frontend build passes; browser acceptance pending |

## Model and data decisions

- BankSim synthetic CSV from Kaggle `ealaxi/banksim1`, CC BY-NC-SA 4.0; source SHA-256 `e37006f76d993bfaec3a02d717b4f0bdc1ebfa5d36449e91fb7c07e225278377`.
- Source: 594,643 rows, 7,200 fraud, 180 simulation days, 50 merchants, 15 categories.
- Train steps 0-107: 332,592 rows/4,320 fraud. Validation 108-143: 128,820/1,440. Final test 144-179: 133,231/1,440.
- Selected LightGBM at validation threshold 0.3228891536. Final full-test AP 0.91336, precision 0.90025, recall 0.76458, F1 0.82689. Test recall is lower than the logistic candidate and is disclosed in the model card.
- The bundled 2,000-row deterministic sample spans all 36 final-test days, has 20 fraud labels, and yields 16 alerts. Sample batch precision 0.9375, recall 0.75, F1 0.8333. The sample changed to make the activity chart and replay meaningful; no full-test scores or metrics were recomputed.
- Python 3.14.7, React 19, Vite 8, FastAPI, LightGBM. The full training dataset is excluded from the deployed package. Review decisions are browser-local and not used as labels.

## Remaining checks

1. Finish Phase 15-19 browser acceptance, correct any issues, and commit the new artifact and UI work.
2. Deploy the final commit and verify all new public flows. A 20,000-row synthetic upload already returned HTTP 200 from Render in 4.36 seconds with 210 alerts; final revision still needs the same acceptance check.
3. Recheck the UI at mobile and projector widths, then close Phase 20.

## Known limitations

- This is a synthetic decision-support demo with no live bank data or real-world calibration.
- The 5 MB/20,000-row limit took 0.23 seconds for an in-process request and 252,596 KB peak process memory on this machine. In Docker constrained to 512 MB and 0.1 CPU, startup took 15.54 seconds, a 20,000-row HTTP upload took 2.64 seconds, and peak cgroup memory was 166,694,912 bytes (about 159 MiB). The deployed free host still needs its own measurement.
- Render free services sleep after inactivity, and uploaded rows disappear after refresh. Review decisions persist only in the same browser until reset.
