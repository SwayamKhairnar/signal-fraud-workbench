# Stage B — Technical specification

Status: **Proposed for Stage B checkpoint**. BankSim and the Stage A brief were approved by the project owner. This specification fixes the implementation choices for the next stage; model performance and hosting capacity remain to be measured during implementation.

## 1. Dataset and reproducibility

**Source:** [BankSim synthetic bank-payment dataset](https://www.kaggle.com/datasets/ealaxi/banksim1), described in the [authors' 2014 paper](https://www.msc-les.org/proceedings/emss/2014/EMSS2014_144.pdf). The paper reports 594,643 simulated payments, 7,200 labeled frauds (about 1.21%), over 180 simulation steps. The file is synthetic; results are evidence about this simulation, not real-bank performance.

**Raw columns expected:** `step`, `customer`, `age`, `gender`, `zipcodeOri`, `merchant`, `zipMerchant`, `category`, `amount`, `fraud`. The download will be inspected before code assumes exact spelling, encoding, allowed values, or row order. The raw file stays out of Git if its size or redistribution terms warrant it; the reproducible download URL, file hash, and preparation command will be documented. Bundle a small derived demo batch and blank template only after checking the dataset's redistribution terms.

**Canonical upload schema v1:** required `transaction_id` (unique text), `step` (nonnegative integer simulation day), `merchant` (known category or `UNKNOWN`), `category` (known category or `UNKNOWN`), `amount` (finite nonnegative decimal in the dataset's units). Optional `fraud` must be entirely `0`/`1` if present. `transaction_id` is generated deterministically from original row position when preparing the bundled sample; it is only a record key, never a model feature. Extra columns are retained for display only if allowed by a documented whitelist; they never become model inputs. The app template and samples use this canonical schema. All uploads are described as **BankSim-format synthetic/demo data**; the app does not accept arbitrary bank schemas or claim to generalize to them.

**Features used by both candidate models:** `step`, `log1p(amount)`, `merchant`, and `category`. No fraud label, transaction ID, customer ID, age, gender, or ZIP field enters the model. Customer and merchant IDs are categorical identifiers, but merchant has a tractable set of values; unseen merchant/category values map to `UNKNOWN`. Excluding customer ID avoids memorizing individuals and makes new-batch scoring independent of customer history. Excluding age and gender avoids making sensitive demographic fields a basis for alerts. The UI can show the original fields only when present, without using them as reasons.

**Cleaning and validation:** enforce UTF-8 CSV with one header row; cap uploads at **5 MB and 20,000 rows** initially. Reject duplicate or absent required headers, invalid label values, empty batches, and files over either limit. For row-level issues, drop exact duplicate transactions and rows with invalid `transaction_id`, `step`, or `amount`; report counts and example row numbers. Missing merchant/category becomes `UNKNOWN`; unknown but nonempty values also become `UNKNOWN` and are counted. Never infer a missing amount or time. Reject a batch if zero valid rows remain or if duplicate `transaction_id` values have conflicting fields. The hard limit is a safe initial product limit, to be measured on the deployed host and adjusted only after evidence.

**Split:** sort by `step`, preserving original order within each step. Divide the **distinct steps** chronologically into approximately 60% train, 20% validation, 20% final test; a step is never split across partitions. Store exact boundaries, row counts, fraud counts, and class prevalence in an artifact manifest. No random train/test split. No resampling in the first version. Imputers, category vocabularies, transformations, and model fitting use the train partition only. If the full train partition exceeds laptop capacity, keep the most recent contiguous train steps that fit, document the new boundary, and leave validation/test untouched. Do not balance the test set or claim metrics from a sampled demo batch are full-test results.

## 2. Training, selection, and evaluation

**Candidates:** (1) scikit-learn logistic regression with a train-fitted one-hot encoder and numeric scaling; (2) LightGBM binary classifier with compact category encoding. The logistic model is the interpretable baseline. LightGBM tests whether a nonlinear model materially improves alert ranking. Training runs offline in a script; the web app never trains. Use fixed random seeds and pinned package versions.

**Selection rule:** compute validation average precision (AP), and choose each model's threshold that maximizes F1 among thresholds flagging at most 5% of validation transactions. Compare the two models at that operating point. Deploy LightGBM only if it improves validation AP by at least **0.02 absolute** and does not reduce validation recall at the chosen operating point; otherwise deploy logistic regression. The rule is set before looking at the final test. If neither model meets a useful recall and alert workload, report that honestly instead of inventing a success target. Save both candidate artifacts for Model Lab and the selected model ID plus threshold in the manifest.

**Final evaluation:** score the untouched final chronological test once after selection. Save prevalence, alert rate, precision, recall, F1, confusion matrix, AP, ROC-AUC, PR and ROC curve points, and fixed-threshold counts for both models. Also report model selection and threshold as validation decisions. In the UI, label AP as “average precision” rather than an ambiguous trapezoidal PR-AUC. Include a prevalence reference line in the PR chart. Avoid accuracy as a headline metric.

**Batch evaluation:** when an uploaded batch includes `fraud`, compute its own metrics from saved scores at the current threshold, identified as “this batch.” Never merge these metrics with the fixed offline test results. If a labeled batch has only one class, display confusion counts and applicable metrics, but mark ROC-AUC or AP unavailable where mathematically undefined. For unlabeled batches, hide evaluation results.

**Risk score:** display `predict_proba` output as a model score from 0–100, not a calibrated real-world fraud probability. The default threshold comes from validation. The slider changes alert membership and batch metrics in the browser using already-returned scores, without rescoring or retraining.

## 3. Explainability

For logistic regression, transform the transaction through the saved encoder and calculate each feature's contribution to the model log-odds as transformed value × coefficient. Group one-hot terms under their source feature. For LightGBM, use its built-in `pred_contrib` output, which yields per-feature contributions plus a base value; verify that summed contributions reproduce the model raw score within numerical tolerance. Present the top **positive** contributions as reasons that raised the score, with feature value and a short plain-English phrase. When no positive contribution is substantial, say the alert is driven by the combined model score and show the largest signed contributions rather than inventing a reason.

Use wording such as “This category increased the model score” and “This amount is high relative to the model's learned patterns,” only when supported by the contribution and a train-derived reference distribution. Do not say a feature caused fraud. Explanations are calculated on demand for any alert, so every flagged transaction can be inspected without computing explanations for all uploaded rows. Cache results in the browser for the active batch. Global importance is mean absolute contribution over a fixed held-out sample, saved offline, and explicitly labeled as model influence rather than causal importance. The same scoring and explanation pipeline handles a hypothetical what-if row if that optional feature is built.

## 4. Application architecture and API

**Frontend:** React + TypeScript + Vite, a small custom CSS design system, Recharts for charts, and Framer Motion for restrained transitions. The production build is served by the same FastAPI service as the API, avoiding cross-origin configuration.

**Backend:** Python FastAPI, pandas for bounded CSV parsing/EDA, scikit-learn and LightGBM for inference. Load saved artifacts once at startup. Use one process on the free host. Validate the upload before full parsing where possible, process up to 20,000 rows, return compact per-row display fields and scores plus aggregated EDA. No server-side session or file retention. Sample data and static Model Lab JSON ship with the app.

**Endpoints:**

| Method and path | Input | Output |
|---|---|---|
| `GET /api/health` | none | status, model version, schema version |
| `GET /api/meta` | none | schema, enum values, limits, model ID, default threshold, metric definitions |
| `GET /api/template.csv` | none | downloadable blank CSV template |
| `GET /api/demo.csv` | none | bundled labeled evaluation batch |
| `GET /api/model-lab` | none | immutable offline test comparison, curves, importance, provenance |
| `POST /api/batches/score` | multipart CSV | batch ID/hash, mode, cleaning report, EDA aggregates, all valid rows with scores and optional labels; no explanations in bulk |
| `POST /api/explain` | canonical transaction fields and selected model version | score, base value, signed source-feature contributions, top reasons |
| `POST /api/what-if` | canonical edited transaction fields | new score and explanation; added only with the optional simulator |

`POST /api/batches/score` is stateless. The frontend keeps the returned batch in memory for threshold filtering and replay. Errors use one JSON shape: `{code, message, details}` with a suitable HTTP status. Show row counts and examples, never a raw stack trace. Restrict CORS to same origin in production; reject unsupported media types. Add basic request limits and dependency pinning. Avoid logging raw transaction rows.

## 5. Browser data schema and analyst workflow

There is **no server database in v1**. A public app with no login cannot safely share analyst decisions in one global SQLite file, and free Render files are erased on restarts. Store only review decisions in browser `localStorage` under a versioned key. The logical record schema is:

| Field | Meaning |
|---|---|
| `schema_version` | local record format version |
| `batch_hash` | hash of normalized batch contents |
| `model_version` | saved model version |
| `transaction_id` | row key in the batch |
| `status` | `needs_review`, `confirmed_fraud`, or `false_alarm` |
| `updated_at` | ISO timestamp |

The key is the tuple `(batch_hash, model_version, transaction_id)`. Provide a “Reset reviews for this batch” action. Do not use analyst reviews as ground-truth labels or training data. Local reviews persist in that browser only; uploaded transaction rows are in memory and disappear on refresh. If durable cross-device review becomes a requirement, add authentication and a persistent database as a later project, not a hidden dependency of this demo.

## 6. Pages, components, and motion

| View | Main components | Animation and interaction |
|---|---|---|
| Start / Intake | demo action, upload zone, template link, schema help, error panel | progress steps and skeleton summary during scoring |
| Overview | summary cards, quality report, amount/type/step charts | count-up metrics and chart entrance; use aggregated points |
| Alerts | sortable/filterable queue, threshold slider, review chips | queue reorders smoothly as threshold changes; no animation on every row |
| Case detail | fields, risk indicator, reasons, review controls | contribution bars grow; text and signed values remain visible |
| Model Lab | model comparison, metric tooltips, confusion matrix, ROC/PR charts, importance | matrix counts fill, lines draw once, bars grow; fixed test vs current batch visually separated |
| Replay | transaction feed, counters, alert panel, pause/1×/5×/20× controls | time-ordered events and new-alert emphasis; client playback of scored rows |

Reduced-motion users see immediate state changes. Colors are not the sole carrier of fraud/status meaning. The layout works on laptop and projector widths, and collapses on mobile. Charts always show numeric labels or tooltips. Replay caps visual event rate and can skip intermediate non-alert rows at 20× while counts remain exact.

## 7. Report and optional features

The minimum deliverable includes every view above, threshold control, and browser-local analyst review. After this path runs end to end, add what-if and PDF report if time permits. The PDF is generated client-side from the active batch summary and explicitly states dataset/model version, threshold, labels present or absent, and review status. It does not claim official bank findings. A what-if change sends one row through the same backend model and explanation path.

## 8. Deployment and measured limits

**Primary target:** one Render free Docker web service serving FastAPI plus the built React app at a single public URL. The free web service currently provides **0.1 CPU and 512 MB RAM**, sleeps after **15 minutes** idle, can take about a minute to wake, and has an ephemeral filesystem ([compute plans](https://render.com/docs/compute-plans), [free service limits](https://render.com/docs/free)). Therefore the offline training dataset is never loaded by the hosted app. Only compact model artifacts, precomputed Model Lab JSON, and a small bundled demo batch are deployed. The 5 MB / 20,000-row cap passed a local Docker test at 0.1 CPU and 512 MB: a 20,000-row HTTP request took 2.64 seconds and peak cgroup memory was about 159 MiB. It still needs measurement on the deployed host. Lower the cap or use a paid 2 GB service if the free tier cannot meet the demo target. No paid service will be provisioned without a separate user decision.

**Hosting alternative:** Hugging Face compute Spaces are not assumed free: current documentation says creating Docker or Gradio compute Spaces requires a paid plan, even though CPU Basic has no hourly charge ([Spaces overview](https://huggingface.co/docs/hub/spaces-overview)). Render static hosting alone cannot run the Python scorer. If Render cannot serve the measured workload, reassess low-cost hosting with actual pricing at deployment time.

**Demo reliability:** bundle a 1,000–2,000-row chronological labeled sample from the untouched test period, with both fraud and non-fraud rows if redistribution is allowed. Do not choose rows by model score or hand-pick only easy frauds. Precompute the fixed offline Model Lab data and make the sample action one click. Warm the free service shortly before the presentation, show a startup state if it is waking, and keep a local Docker/venv fallback for rehearsal. The public link remains the deliverable; the fallback is for demonstration reliability.

## 9. Project structure

```text
proj/
  README.md
  STAGE_A_REVIEW.md
  TECHNICAL_SPECIFICATION.md
  IMPLEMENTATION_GUIDE.md
  PROGRESS.md
  backend/
    app/
      main.py
      api.py
      schemas.py
      validation.py
      preprocessing.py
      scoring.py
      explanations.py
      eda.py
    tests/
    requirements.txt
  frontend/
    src/
      app/
      components/
      pages/
      charts/
      lib/
    package.json
  ml/
    prepare_data.py
    train.py
    evaluate.py
    artifacts/
      manifest.json
      selected_model.*
      baseline_model.*
      model_lab.json
  data/
    README.md
    sample_labeled.csv
    template.csv
  deploy/
    Dockerfile
    render.yaml
  docs/
    DEMO_SCRIPT.md
```

Generated full training data, upload files, and local caches are ignored by Git. The saved artifacts are versioned with the feature schema and package versions, and backend startup fails clearly if they do not match.

## 10. Verification gates

Before Stage D begins, the implementation guide will break this into small runnable phases. The following checks are required during the build:

1. Inspect downloaded BankSim file and record actual columns, categories, hash, and license/redistribution terms.
2. Reproduce chronological split and prove no step overlaps partitions; prove train-only preprocessing.
3. Verify selected threshold and model come only from validation; final test is reported once.
4. Verify explanation contributions reconstruct model raw score and reasons match their sign.
5. Verify unlabeled uploads never show label-dependent metrics, and labeled single-class batches do not crash.
6. Verify duplicate/invalid uploads return understandable cleaning reports or errors.
7. Measure 20,000-row upload on the target host, including peak memory and response time; adjust the documented cap to a safe value.
8. Verify public sample flow, replay, review persistence in one browser, reset, and cold-start behavior.

## Sources checked for this specification

- [BankSim authors' paper](https://www.msc-les.org/proceedings/emss/2014/EMSS2014_144.pdf) and [dataset listing](https://www.kaggle.com/datasets/ealaxi/banksim1)
- [LightGBM feature-contribution API](https://lightgbm.readthedocs.io/en/stable/pythonapi/lightgbm.LGBMModel.html)
- [scikit-learn definition of average precision](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.average_precision_score.html)
- [Render free-service limits](https://render.com/docs/free) and [compute plans](https://render.com/docs/compute-plans)
- [Hugging Face Spaces current plan requirements](https://huggingface.co/docs/hub/spaces-overview)
