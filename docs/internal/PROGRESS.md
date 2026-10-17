# Project progress

## Current stage

Stage D: Phases 1-13 implemented. The [Render service](https://signal-fraud-workbench.onrender.com/) is live and its health endpoint loads the saved model. Phase 14 is preserving and deploying the newer local visual and explanation work. Phases 15-20 in the [implementation guide](IMPLEMENTATION_GUIDE.md) cover reliability, blind review, validation error analysis, workload decisions, guided demonstration, and final public acceptance.

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

## Model and data decisions

- BankSim synthetic CSV from Kaggle `ealaxi/banksim1`, CC BY-NC-SA 4.0; source SHA-256 `e37006f76d993bfaec3a02d717b4f0bdc1ebfa5d36449e91fb7c07e225278377`.
- Source: 594,643 rows, 7,200 fraud, 180 simulation days, 50 merchants, 15 categories.
- Train steps 0-107: 332,592 rows/4,320 fraud. Validation 108-143: 128,820/1,440. Final test 144-179: 133,231/1,440.
- Selected LightGBM at validation threshold 0.3228891536. Final full-test AP 0.91336, precision 0.90025, recall 0.76458, F1 0.82689. Test recall is lower than the logistic candidate and is disclosed in the model card.
- The bundled 2,000-row deterministic sample spans all 36 final-test days, has 20 fraud labels, and yields 16 alerts. Sample batch precision 0.9375, recall 0.75, F1 0.8333. The sample changed to make the activity chart and replay meaningful; no full-test scores or metrics were recomputed.
- Python 3.14.7, React 19, Vite 8, FastAPI, LightGBM. The full training dataset is excluded from the deployed package. Review decisions are browser-local and not used as labels.

## Remaining checks

1. Sync the Phase 14 revision to Render and verify the public sample, explanation, and Model Lab UI.
2. Measure public-host 20,000-row scoring and recheck the UI at mobile and projector widths.
3. Implement and verify Phases 15-20 in order.

## Known limitations

- This is a synthetic decision-support demo with no live bank data or real-world calibration.
- The 5 MB/20,000-row limit took 0.23 seconds for an in-process request and 252,596 KB peak process memory on this machine. In Docker constrained to 512 MB and 0.1 CPU, startup took 15.54 seconds, a 20,000-row HTTP upload took 2.64 seconds, and peak cgroup memory was 166,694,912 bytes (about 159 MiB). The deployed free host still needs its own measurement.
- Render free services sleep after inactivity, and uploaded rows disappear after refresh. Review decisions persist only in the same browser until reset.
