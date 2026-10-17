# Implementation guide

This is the phase-by-phase build plan for the [approved brief](STAGE_A_REVIEW.md) and [technical specification](TECHNICAL_SPECIFICATION.md). Run commands from the project root unless a command begins with `cd`. Python 3.14.7 and Node 22 are the target runtimes. Each phase leaves the current app runnable. The AI updates `PROGRESS.md` after completing a phase and verifies the listed checks before moving on.

## Phase 1 — Runnable project foundation

**Goal:** A local React page and FastAPI health endpoint start successfully, with a clear repository layout and ignore rules.

**Tasks:** 1. Create backend and frontend projects. 2. Add a small design foundation and a health-status call. 3. Pin the initial runtime, install dependencies, and document local startup.

**Files:** `.gitignore`, `.python-version`, `backend/requirements.txt`, `backend/app/main.py`, `backend/app/__init__.py`, `frontend/package.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/*`, `README.md`, `PROGRESS.md`.

**Run/test:**

```bash
uv python install 3.14.7
uv venv --python 3.14.7 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt
cd frontend && npm install && npm run build
```

In separate terminals:

```bash
.venv/bin/python -m uvicorn backend.app.main:app --reload --port 8000
cd frontend && npm run dev
```

Visit `http://localhost:5173` and `http://localhost:8000/api/health`.

**Definition of done:** [ ] Frontend builds. [ ] Both servers start. [ ] The page reports a healthy API. [ ] README startup steps are correct.

**Demo-ability:** Show the branded shell and live backend status.

## Phase 2 — BankSim intake and canonical data

**Goal:** Raw BankSim can be inspected and reproducibly converted to the versioned app schema without model training.

**Tasks:** 1. Download and inspect the source file and terms. 2. Record hash, counts, classes, steps, categories. 3. Build deterministic normalization and chronological split files. 4. Prepare template and a small development sample, retaining the final test for later demo extraction.

**Files:** `data/README.md`, `data/template.csv`, `data/sample_dev.csv`, `data/source_profile.json`, `ml/prepare_data.py`, `ml/inspect_data.py`, `data/processed/split_manifest.json`, `backend/tests/test_data_contract.py`, `.gitignore`, `PROGRESS.md`.

**Run/test:**

```bash
.venv/bin/python ml/inspect_data.py --input data/raw/bs140513_032310.csv --output data/source_profile.json
.venv/bin/python ml/prepare_data.py --input data/raw/bs140513_032310.csv --output data/processed
uv pip install --python .venv/bin/python -r backend/dev-requirements.txt
.venv/bin/python -m pytest backend/tests/test_data_contract.py
```

Dataset acquisition and the verified filename are documented in `data/README.md`. Existing Phase 1 servers still start.

**Definition of done:** [ ] Source hash and license note recorded. [ ] Split steps do not overlap. [ ] Positive counts/prevalence reported. [ ] Template matches the canonical schema. [ ] No raw full dataset committed.

**Demo-ability:** Show the data contract and chronological split summary.

## Phase 3 — Offline training and artifacts

**Goal:** Two reproducible models, an untouched test evaluation, and compact inference artifacts exist.

**Tasks:** 1. Fit training-only preprocessing and logistic baseline. 2. Fit LightGBM candidate. 3. Choose model and threshold on validation under the documented rule. 4. Evaluate final test once. 5. Save models, manifest, curves, feature contributions, and a representative labeled demo batch.

**Files:** `ml/train.py`, `ml/evaluate.py`, `ml/artifacts/*`, `data/sample_labeled.csv`, `backend/tests/test_training_contract.py`, `PROGRESS.md`.

**Run/test:**

```bash
.venv/bin/python ml/train.py --data data/processed --output ml/artifacts
.venv/bin/python ml/evaluate.py --data data/processed --artifacts ml/artifacts
.venv/bin/python -m pytest backend/tests/test_training_contract.py
```

**Definition of done:** [ ] Validation-only model/threshold choice. [ ] Final test prevalence and metrics saved. [ ] Artifacts reload and score the same rows. [ ] No test labels used in training or selection. [ ] Demo sample provenance recorded.

**Demo-ability:** Show a reproducible model comparison and offline results in generated JSON/plots.

## Phase 4 — Scoring API walking skeleton

**Goal:** A CSV can be uploaded locally and every valid row receives a score; bad inputs yield clear errors.

**Tasks:** 1. Load versioned artifacts at startup. 2. Implement `/api/meta`, template/sample downloads, and `/api/batches/score`. 3. Validate and clean uploads, aggregate EDA, and return compact score rows. 4. Add contract tests.

**Files:** `backend/app/api.py`, `schemas.py`, `validation.py`, `preprocessing.py`, `scoring.py`, `eda.py`, `main.py`, `backend/tests/test_api.py`, `PROGRESS.md`.

**Run/test:**

```bash
.venv/bin/python -m pytest backend/tests/test_api.py
.venv/bin/python -m uvicorn backend.app.main:app --port 8000
curl -fsS http://localhost:8000/api/health
curl -fsS -F file=@data/sample_labeled.csv http://localhost:8000/api/batches/score > /tmp/fraud-batch.json
```

**Definition of done:** [ ] Labeled and unlabeled files score. [ ] All valid rows have model scores. [ ] Cleaning counts add up. [ ] Invalid file/type/size/columns fail clearly. [ ] No training occurs at request time.

**Demo-ability:** Upload a batch through the API and inspect ranked scores.

## Phase 5 — Frontend intake and overview

**Goal:** A user can load the sample or upload CSV and see scores, batch quality, and useful charts in the browser.

**Tasks:** 1. Add routing/layout and typed API client. 2. Build upload states and schema help. 3. Build overview cards and aggregated amount/type/step charts. 4. Show labeled proportions only in evaluation mode.

**Files:** `frontend/src/app/*`, `frontend/src/pages/Intake.tsx`, `Overview.tsx`, `frontend/src/components/*`, `frontend/src/lib/api.ts`, `frontend/src/charts/*`, `PROGRESS.md`.

**Run/test:**

```bash
cd frontend && npm run build && npm run dev
```

With the Phase 4 backend running, load the sample, upload `data/sample_labeled.csv`, then upload `data/template.csv` and inspect the empty-batch error.

**Definition of done:** [ ] One-click sample loads. [ ] Compatible upload loads. [ ] Errors are readable. [ ] Overview counts match API data. [ ] Unlabeled mode shows no fraud proportions.

**Demo-ability:** Show the first complete browser flow from file to scored overview.

## Phase 6 — Alerts and faithful explanations

**Goal:** Every flagged row can be opened with model-derived reasons.

**Tasks:** 1. Implement on-demand `/api/explain`. 2. Check contribution sum/sign. 3. Build ranked queue, filters, case detail, and reason bars. 4. Cache opened explanations for the active batch.

**Files:** `backend/app/explanations.py`, `backend/app/api.py`, `backend/tests/test_explanations.py`, `frontend/src/pages/Alerts.tsx`, `CaseDetail.tsx`, `frontend/src/components/ReasonBars.tsx`, `PROGRESS.md`.

**Run/test:**

```bash
.venv/bin/python -m pytest backend/tests/test_explanations.py
cd frontend && npm run build
```

Open multiple alerts in the running app and compare the displayed score with the queue score.

**Definition of done:** [ ] Every alert opens. [ ] Reasons are signed, model-derived, and noncausal. [ ] Contribution reconstruction test passes. [ ] Unknown categories and missing merchant values work.

**Demo-ability:** Open a high-risk transaction and explain the key model factors.

## Phase 7 — Model Lab and evaluation visuals

**Goal:** Precomputed offline results and current labeled-batch metrics are clear and visually distinct.

**Tasks:** 1. Serve model-lab JSON. 2. Build candidate comparison, metric definitions, confusion matrix, ROC and PR charts, global importance. 3. Add restrained entrance animation and one-class handling.

**Files:** `backend/app/api.py`, `frontend/src/pages/ModelLab.tsx`, `frontend/src/charts/*`, `frontend/src/lib/metrics.ts`, `PROGRESS.md`.

**Run/test:**

```bash
curl -fsS http://localhost:8000/api/model-lab > /tmp/model-lab.json
cd frontend && npm run build
```

Verify the fixed-test values against `ml/artifacts/manifest.json`, then load both labeled and unlabeled batches.

**Definition of done:** [ ] Fixed test and current batch never appear as one dataset. [ ] Every metric has a definition. [ ] ROC/AP unavailable states are handled. [ ] Charts remain readable with reduced motion.

**Demo-ability:** Compare the two offline models and explain the confusion matrix and PR curve.

## Phase 8 — Replay

**Goal:** Already-scored transactions play back in chronological order with exact running counts.

**Tasks:** 1. Implement client playback engine. 2. Add pause, restart, 1×/5×/20×. 3. Animate alert arrivals and counters. 4. Update running metrics only when labels exist.

**Files:** `frontend/src/pages/Replay.tsx`, `frontend/src/lib/replay.ts`, `frontend/src/components/ReplayControls.tsx`, `PROGRESS.md`.

**Run/test:**

```bash
cd frontend && npm run build
```

Load the sample and check final replay counts against Overview at each speed.

**Definition of done:** [ ] Order follows `step` then input order. [ ] Pause/resume/restart work. [ ] Final counts agree with batch totals. [ ] Unlabeled replay hides running precision/recall.

**Demo-ability:** Play the batch as a monitoring console.

## Phase 9 — Threshold and analyst review

**Goal:** The analyst can control alert workload and record browser-local decisions.

**Tasks:** 1. Recalculate queue and labeled metrics from saved scores as threshold moves. 2. Add explicit hypothetical cost inputs if cost view is included. 3. Store per-batch reviews locally and provide reset. 4. Check decisions stay separate from source labels.

**Files:** `frontend/src/components/ThresholdControl.tsx`, `frontend/src/lib/metrics.ts`, `frontend/src/lib/reviews.ts`, `frontend/src/pages/Alerts.tsx`, `CaseDetail.tsx`, `PROGRESS.md`.

**Run/test:**

```bash
cd frontend && npm run build
```

Move the threshold to both extremes; refresh the browser; reset reviews.

**Definition of done:** [ ] Alert count changes consistently. [ ] Labeled metrics recalculate exactly. [ ] Reviews persist in one browser and reset. [ ] Reviews do not alter ground-truth metrics.

**Demo-ability:** Show the precision/recall workload tradeoff and case workflow.

## Phase 10 — What-if and PDF extras

**Goal:** A hypothetical edit can be rescored, and the current batch can be exported as a clearly labeled report.

**Tasks:** 1. Add what-if API and case editor. 2. Reuse scoring/explanation pipeline. 3. Create a client-generated summary PDF. 4. Show source and model/version statements.

**Files:** `backend/app/api.py`, `backend/tests/test_what_if.py`, `frontend/src/components/WhatIf.tsx`, `frontend/src/lib/report.ts`, `PROGRESS.md`.

**Run/test:**

```bash
.venv/bin/python -m pytest backend/tests/test_what_if.py
cd frontend && npm run build
```

Change amount/category and check the displayed score updates; inspect the PDF in a viewer.

**Definition of done:** [ ] What-if uses the saved model. [ ] Original row remains unchanged. [ ] PDF labels source data and whether metrics need labels. [ ] Export opens correctly.

**Demo-ability:** Show one edited scenario and take away a batch report.

## Phase 11 — Visual and accessibility polish

**Goal:** The app looks coherent and remains usable with motion reduced, keyboard navigation, and projected display.

**Tasks:** 1. Refine spacing, typography, color contrast, skeletons, and empty states. 2. Add theme only if the required path is stable. 3. Check keyboard focus and reduced motion. 4. Test laptop, projector, and mobile widths.

**Files:** `frontend/src/styles.css`, relevant pages/components, `PROGRESS.md`.

**Run/test:**

```bash
cd frontend && npm run build
```

Manually inspect at 375 px, 1024 px, and 1440 px widths and with reduced motion enabled.

**Definition of done:** [ ] No clipped key controls. [ ] Keyboard path covers intake, queue, case, replay. [ ] Motion has a reduced setting. [ ] Loading/error/empty states are clear.

**Demo-ability:** Present a polished end-to-end UI.

## Phase 12 — Reliability and rehearsal

**Goal:** The sample path and edge cases are reliable and documented for a viva.

**Tasks:** 1. Run backend contract tests and frontend build. 2. Test malformed, unlabeled, labeled, and single-class CSVs. 3. Measure the upload cap and memory locally. 4. Write a short click-by-click demo script and known limitations.

**Files:** `backend/tests/*`, `docs/DEMO_SCRIPT.md`, `README.md`, `PROGRESS.md`.

**Run/test:**

```bash
.venv/bin/python -m pytest backend/tests
cd frontend && npm run build
```

Run the demo script from a fresh browser session.

**Definition of done:** [ ] Required tests pass. [ ] Sample demo works without training. [ ] Counts and labels are honest. [ ] Presentation path fits the available time.

**Demo-ability:** Full local rehearsal.

## Phase 13 — Public deployment

**Goal:** The same workflow works from a public link.

**Tasks:** 1. Build frontend into a FastAPI-served static bundle. 2. Deploy a single Render free service. 3. Measure 20,000-row upload, peak memory, startup, and cold start; lower the cap if needed. 4. Update README and demo script with the verified URL and pre-demo warm-up step.

**Files:** `deploy/Dockerfile`, root `render.yaml`, `backend/app/main.py`, `README.md`, `docs/DEMO_SCRIPT.md`, `PROGRESS.md`.

**Run/test:**

```bash
cd frontend && npm run build
.venv/bin/python -m pytest backend/tests
docker build -f deploy/Dockerfile -t fraud-workbench .
docker run --rm -p 8000:8000 fraud-workbench
```

After deployment, open the public URL and run the demo script from a fresh browser. The deployment action itself uses the configured Render account or its dashboard; exact account-specific commands are recorded when that connection is available.

**Definition of done:** [ ] Public link loads. [ ] Sample upload, alert explanation, threshold, and replay work there. [ ] Tested cap fits host memory. [ ] No raw upload survives processing. [ ] Public URL and known free-tier wake-up behavior are documented.

**Demo-ability:** Complete end-to-end presentation from the public link.
