# Project progress

## Current stage

Stage D: Phases 1-20 are complete. Commit `ee08f62` is live on the [Render service](https://signal-fraud-workbench.onrender.com/) (deploy `dep-db9tfmvavr4c73fbt340`). The public sample scores 2,000 rows with 16 alerts, and blind review, validation error analysis, workload controls, explanations, replay, and report download passed browser checks. The [implementation guide](IMPLEMENTATION_GUIDE.md) records each phase.

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
| 15 | Correctness and resilience | Public stale-scenario reset verified; 2,000-alert queue paged at 100 rows; retries added; build passes |
| 16 | Blind review | Public labels hidden until explicit reveal, decision comparison verified against known sample labels |
| 17 | Validation error analysis | 128,820-row validation artifact and public view verified; 14 backend tests pass |
| 18 | Workload and illustrative cost | Public threshold extremes checked: 0% flags 2,000/2,000 and reports 20/20 fraud caught; penalty points and validation curve visible |
| 19 | Contribution comparison and demo guide | Public five-step walkthrough, scenario factor changes, and 20x replay verified; frontend build passes |
| 20 | Final public acceptance | Commit `ee08f62` deployed live; final bundle `index-QjvbEthN.js`, health/model and 128,820-row validation API checked; laptop and 375px mobile UI reviewed; generated public PDF has one A4 page with correct sample metrics |

## Model and data decisions

- BankSim synthetic CSV from Kaggle `ealaxi/banksim1`, CC BY-NC-SA 4.0; source SHA-256 `e37006f76d993bfaec3a02d717b4f0bdc1ebfa5d36449e91fb7c07e225278377`.
- Source: 594,643 rows, 7,200 fraud, 180 simulation days, 50 merchants, 15 categories.
- Train steps 0-107: 332,592 rows/4,320 fraud. Validation 108-143: 128,820/1,440. Final test 144-179: 133,231/1,440.
- Selected LightGBM at validation threshold 0.3228891536. Final full-test AP 0.91336, precision 0.90025, recall 0.76458, F1 0.82689. Test recall is lower than the logistic candidate and is disclosed in the model card.
- The bundled 2,000-row deterministic sample spans all 36 final-test days, has 20 fraud labels, and yields 16 alerts. Sample batch precision 0.9375, recall 0.75, F1 0.8333. The sample changed to make the activity chart and replay meaningful; no full-test scores or metrics were recomputed.
- Python 3.14.7, React 19, Vite 8, FastAPI, LightGBM. The full training dataset is excluded from the deployed package. Review decisions are browser-local and not used as labels.

## Next evidence to collect

- A 20,000-row synthetic upload returned HTTP 200 from Render in 4.36 seconds with 210 alerts on the Phase 19 revision; repeat the load check if the service configuration changes.
- A real-bank pilot would need a licensed, representative dataset, temporal and entity leakage review, calibrated operating thresholds, privacy controls, and analyst outcome tracking before any operational use.

## Known limitations

- This is a synthetic decision-support demo with no live bank data or real-world calibration.
- The 5 MB/20,000-row limit took 0.23 seconds for an in-process request and 252,596 KB peak process memory on this machine. In Docker constrained to 512 MB and 0.1 CPU, startup took about 25 seconds on the final image; a 20,000-row HTTP upload took 2.64 seconds on the earlier image, and peak cgroup memory was 166,694,912 bytes (about 159 MiB). The public Render request took 4.36 seconds. Free-host cold starts vary.
- Render free services sleep after inactivity, and uploaded rows disappear after refresh. Review decisions persist only in the same browser until reset.
- Three pre-existing local `data/sample_val_*.csv` files are excluded from commits because their repeated transaction IDs disagree with the prepared validation split. They were left untouched for the owner to reconcile.
