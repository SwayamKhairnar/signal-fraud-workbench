# Implementation guide

This is the phase-by-phase build plan for the [approved brief](STAGE_A_REVIEW.md) and [technical specification](../../TECHNICAL_SPECIFICATION.md). Run commands from the project root unless a command begins with `cd`. Python 3.14.7 and Node 22 are the target runtimes. Each phase leaves the current app runnable. The AI updates `PROGRESS.md` after completing a phase and verifies the listed checks before moving on. The owner has authorized technical decisions and continuous work across phases; the checkpoints in the original brief no longer require a pause.

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

## Phase 14 — Preserve and deploy the current revision

**Goal:** The current local visual and explanation changes become a reproducible public baseline before further work.

**Tasks:** 1. Review all uncommitted files and document validation example batches. 2. Fix documentation links and record the real public URL. 3. Run backend tests and frontend build. 4. Commit and push the current revision. 5. Sync Render and verify the public sample, explanation, and Model Lab endpoints and UI.

**Files:** `README.md`, `data/README.md`, `docs/internal/PROGRESS.md`, the already changed frontend/backend files, and `data/sample_val_*.csv` if their source is verified.

**Run/test:** `.venv/bin/python -m pytest backend/tests -q`, `cd frontend && npm run build`, then check the public `/api/health` and sample flow after the deployment becomes live.

**Definition of done:** [ ] Commit is pushed. [ ] Render serves its new frontend bundle. [ ] Public sample and explanation agree with local model scores. [ ] Documentation links resolve.

**Demo-ability:** The public link shows the latest polished baseline.

## Phase 15 — Correctness and resilience

**Goal:** Switching cases, editing what-if inputs, moving thresholds, and loading the service never display stale or misleading state.

**Tasks:** 1. Reset scenario results when inputs change and show the actual scenario threshold. 2. Reset case errors on row change and keep selection inside the filtered queue. 3. Handle missing metadata/Model Lab with retry states. 4. Bound queue rendering. 5. Add focused interaction checks for these failures.

**Files:** `frontend/src/app/App.tsx`, `frontend/src/pages/Alerts.tsx`, `frontend/src/pages/CaseDetail.tsx`, `frontend/src/components/WhatIf.tsx`, frontend test files.

**Run/test:** `cd frontend && npm run build` plus browser interaction checks on sample, one invalid upload, and a low threshold.

**Definition of done:** [ ] No stale what-if result or case error. [ ] Threshold/filter changes never leave a hidden selected case. [ ] Partial API failure has a visible retry. [ ] Large queues remain usable.

**Demo-ability:** Reliable exploration during questions from a teacher.

## Phase 16 — Blind analyst review

**Goal:** The analyst can judge cases without seeing the answer, then reveal labels to learn from disagreement.

**Tasks:** 1. Hide source labels in the queue and case panel by default. 2. Add a deliberate reveal action for labeled batches. 3. Compare saved browser-local decisions with revealed labels without altering metrics. 4. Make unlabeled uploads use the same review UI without a reveal option.

**Files:** `frontend/src/pages/Alerts.tsx`, `frontend/src/pages/CaseDetail.tsx`, `frontend/src/lib/reviews.ts`, frontend checks.

**Run/test:** Review sample cases before and after reveal; verify no source label appears in blind mode or on an unlabeled upload.

**Definition of done:** [ ] Blind mode has no label leakage. [ ] Reveal is explicit. [ ] Decisions persist per batch in this browser. [ ] Ground truth and analyst decisions remain separate.

**Demo-ability:** Five-case analyst challenge with a reveal at the end.

## Phase 17 — Validation error analysis

**Goal:** Show where the model succeeds and fails without adapting to the final test set.

**Tasks:** 1. Produce a versioned, compact validation-period artifact from the saved model with counts and confusion by amount band, category, and simulation period. 2. Expose it through a read-only API. 3. Add an Error Analysis view with segment filters, honest small-sample warnings, and a few anonymized missed-fraud examples. 4. Keep the fixed final-test Model Lab results separate.

**Files:** `ml/build_error_analysis.py`, `ml/artifacts/validation_analysis.json`, `backend/app/api.py`, `backend/tests/*`, `frontend/src/pages/ErrorAnalysis.tsx`, `frontend/src/lib/api.ts`.

**Run/test:** Rebuild the artifact from `data/processed/validation.csv`; test aggregate counts against saved validation metrics; run backend tests and frontend build.

**Definition of done:** [ ] Segment counts sum correctly. [ ] Data source is visibly validation, not final test. [ ] Low-amount misses and uncertainty from small groups are clear. [ ] No new model choice uses final-test labels.

**Demo-ability:** Explain a concrete model blind spot and a measured improvement hypothesis.

## Phase 18 — Workload and cost exploration

**Goal:** Make the threshold a transparent review-budget decision.

**Tasks:** 1. Plot validation fraud caught against alert workload across thresholds. 2. Connect the current batch slider to exact score-based metrics and reviewed-row counts. 3. Relabel the cost panel as an illustrative scenario, remove unearned rupee assumptions, and state all inputs. 4. Keep one-class and unlabeled states honest.

**Files:** `ml/artifacts/validation_analysis.json`, `frontend/src/pages/Alerts.tsx`, `frontend/src/pages/ErrorAnalysis.tsx`, frontend checks.

**Run/test:** Verify plotted threshold points against validation scores and queue counts; run the build and check slider extremes in the browser.

**Definition of done:** [ ] Workload/recall arithmetic matches the source data. [ ] No cost is presented as a real bank estimate. [ ] The slider remains usable at the saved threshold.

**Demo-ability:** Answer “How many alerts can analysts handle?” with a visible tradeoff.

## Phase 19 — Explanation comparison and guided demo

**Goal:** Make scenario changes and the presentation story easier to understand.

**Tasks:** 1. Display the change in each model contribution between original and hypothetical rows. 2. Add a concise guided sample path through review, threshold, model limitations, and replay. 3. Ensure reduced motion and keyboard use still work. 4. Update the demo script.

**Files:** `frontend/src/components/WhatIf.tsx`, `frontend/src/app/App.tsx`, `frontend/src/styles.css`, `docs/DEMO_SCRIPT.md`.

**Run/test:** Complete the guide from a fresh browser and compare explanation sums and scenario scores; run backend tests and frontend build.

**Definition of done:** [ ] Scenario delta is faithful to model contributions. [ ] Guide can be skipped. [ ] Demo fits about five minutes. [ ] No visual step implies real-time training or calibrated risk.

**Demo-ability:** A cohesive teacher presentation with a clear ML limitation and human response.

## Phase 20 — Final public acceptance

**Goal:** The latest version is deployed, documented, and ready to present.

**Tasks:** 1. Run all tests and review every new surface at laptop and mobile widths. 2. Push a clean source revision and sync Render. 3. Test the public sample, blind review, error analysis, workload control, scenario, replay, and report. 4. Record cold-start behavior and known limitations.

**Files:** `README.md`, `docs/DEMO_SCRIPT.md`, `docs/internal/PROGRESS.md`, any files needed to fix acceptance failures.

**Run/test:** `.venv/bin/python -m pytest backend/tests -q`, `cd frontend && npm run build`, followed by the public click-by-click demo.

**Definition of done:** [ ] Public link serves the new revision. [ ] Core workflow and new features pass live checks. [ ] Repository is clean and docs match the app.

**Demo-ability:** Final public AIML MVP.
