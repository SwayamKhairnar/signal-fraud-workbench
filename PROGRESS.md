# Project progress

## Current stage

Stage D: Phases 1-12 implemented and checked locally. Phase 13 is packaged for one Render Docker service; the public account deployment and live URL are not yet verified.

The project owner approved the final brief and BankSim, delegated technical choices, and asked the AI to evaluate each phase and continue without routine questions. The original brief's pause checkpoints are superseded by that request.

## Completed phases and evidence

| Phase | Result | Check |
|---|---|---|
| 1 | React/FastAPI walking skeleton | Browser showed service connected; build and health passed |
| 2 | BankSim source inspected and chronological split | 594,643 rows; split contract test |
| 3 | Logistic and LightGBM trained, validation selection, untouched final test | Saved manifest, model card, artifact reload tests |
| 4 | Bounded stateless upload, cleaning, scoring, EDA, model lab API | API contract tests and live local sample |
| 5 | Intake and overview | Sample loaded: 2,000 scored, 14 alerts; overview browser inspection |
| 6 | Alert queue, case detail, exact model contributions | Explanation reconstruction tests, including unknown values |
| 7 | Fixed-test Model Lab and separate current-batch metrics/curves | Frontend build; artifact data keys checked |
| 8 | Chronological replay with pause, restart, and 1x/5x/20x | Final replay totals checked against scoring result |
| 9 | Threshold tradeoff and browser-local review statuses | Client metrics checked against backend confusion and scores |
| 10 | What-if rescoring and PDF export | What-if API test; sample PDF generated, rendered, and inspected |
| 11 | Responsive and keyboard/reduced-motion CSS | Production build passes; visual browser recheck blocked by browser policy |
| 12 | Reliability and demo script | 13 backend tests pass; frontend build passes; 20k-row sample scored locally |
| 13 | Single-service package | Dockerfile, render.yaml, static serving, and local static smoke test; Docker image build in progress |

## Model and data decisions

- BankSim synthetic CSV from Kaggle `ealaxi/banksim1`, CC BY-NC-SA 4.0; source SHA-256 `e37006f76d993bfaec3a02d717b4f0bdc1ebfa5d36449e91fb7c07e225278377`.
- Source: 594,643 rows, 7,200 fraud, 180 simulation days, 50 merchants, 15 categories.
- Train steps 0-107: 332,592 rows/4,320 fraud. Validation 108-143: 128,820/1,440. Final test 144-179: 133,231/1,440.
- Selected LightGBM at validation threshold 0.3228891536. Final full-test AP 0.91336, precision 0.90025, recall 0.76458, F1 0.82689. Test recall is lower than the logistic candidate and is disclosed in the model card.
- The bundled 2,000-row chronological test sample has 20 fraud labels and yields 14 alerts. Sample batch precision 0.92857, recall 0.65, F1 0.76471.
- Python 3.14.7, React 19, Vite 8, FastAPI, LightGBM. The full training dataset is excluded from the deployed package. Review decisions are browser-local and not used as labels.

## Remaining checks

1. Finish the Docker build and run its sample path locally, including static assets and model loading.
2. Obtain a connected Render deployment destination and verify its public URL, 20,000-row memory, and cold start. No Render account or Git remote is configured in this checkout yet.
3. Recheck the complete UI at mobile and projector widths when browser control permits it. The browser policy rejected the local page after the initial overview inspection; builds and API tests continue to pass.

## Known limitations

- This is a synthetic decision-support demo with no live bank data or real-world calibration.
- The 5 MB/20,000-row limit took 0.23 seconds for an in-process 20,000-row scoring request and 252,596 KB peak process memory on this machine. The deployed free host has a different CPU and memory profile.
- Render free services sleep after inactivity, and uploaded rows disappear after refresh. Review decisions persist only in the same browser until reset.
