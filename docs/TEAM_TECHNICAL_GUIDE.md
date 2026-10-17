# Signal: team technical and presentation guide

**Purpose.** This is the team's main handoff document for the implemented Signal Banking Fraud Analyst Workbench. Read it before demonstrating the project or changing the model. It describes the current code and saved artifact version `banksim-v1-001`, rather than an aspirational design. The [public demo](https://signal-fraud-workbench.onrender.com/) may take time to wake on Render's free service.

**One-sentence description.** Signal takes a small BankSim-format CSV, applies a previously trained LightGBM model to rank synthetic transactions for human review, and shows the model's evidence, measured errors, and review workload without claiming to be a real banking fraud system.

## 1. The mental model everyone should remember

```text
Original BankSim CSV (594,643 labeled synthetic payments)
        │ offline, chronological split by whole simulation day
        ├─ Train: days 0–107 ── fit preprocessing + logistic and LightGBM
        ├─ Validation: days 108–143 ── choose each threshold and deployed model
        │                              └─ precompute Blind Spots analysis
        └─ Final test: days 144–179 ── evaluate locked candidates once
                                       └─ evenly spaced 2,000-row demo slice

CSV/demo input → validate and clean → same saved preprocessing → saved LightGBM
             → model scores + batch summaries → browser views
             → analyst reviews stay in this browser; no retraining
```

The three number sets must stay separate:

| Evidence | Purpose | Rows | May it choose the model? |
|---|---|---:|---|
| Training | Fit encoder, scaler, and model parameters | 332,592 | It fits candidates, but does not judge their generalization. |
| Validation | Choose operating threshold and LightGBM versus logistic; inspect errors | 128,820 | **Yes.** This is where the choice was made. |
| Final test | Report how the locked choices behaved on later days | 133,231 | **No.** It is an evaluation, not a tuning set. |
| Bundled demo | Make the application easy to show | 2,000 of the final-test rows | **No.** Its metrics describe only this slice. |

The application is **batch decision support**. The user supplies a file or loads the bundled sample; the server scores it once. The threshold slider and replay reuse those scores. Neither is online learning, live streaming, or a real bank connection.

## 2. Problem, data source, and data contract

### What problem are we solving?

Fraud is rare, so a reviewer cannot inspect every transaction. Signal ranks payments by a model score and makes the resulting alert workload and mistakes visible. A high score is a prompt to investigate, **not a confirmed fraud decision**. The cost panel uses adjustable *penalty points* for a teaching scenario; it does not estimate a bank's monetary loss.

### BankSim provenance and limits

The source is the [BankSim dataset](https://www.kaggle.com/datasets/ealaxi/banksim1), attributed to Edgar Alonso Lopez-Rojas and Stefan Axelsson and listed under CC BY-NC-SA 4.0. It contains 594,643 synthetic payments: 587,443 legitimate and 7,200 labeled fraud, a 1.21% fraud prevalence. It has 180 simulation steps (`0`–`179`), 50 merchants, and 15 purchase categories. Around 85% of transactions are in the `es_transportation` category, so class balance is not the only imbalance worth noticing. The inspected CSV had no blank fields or invalid amounts. The source file's SHA-256 is `e37006f76d993bfaec3a02d717b4f0bdc1ebfa5d36449e91fb7c07e225278377`.

The raw columns are `step,customer,age,gender,zipcodeOri,merchant,zipMerchant,category,amount,fraud`. A **step is a simulation day**, not a calendar date. An **amount is in simulator units**, not rupees or another currency. The full source and prepared full partitions are excluded from Git; the small attributed demo sample is included. No conclusion here is a measured real-bank fraud result.

### Canonical CSV presented to the app

Required headers are `transaction_id,step,merchant,category,amount`; the optional `fraud` header must contain `0` or `1` on **every** row if supplied. `transaction_id` is generated from source row position in prepared data and is only a record/review key. Merchant and category quotes in the original CSV are stripped during preparation. The app accepts UTF-8 CSV up to **5 MiB and 20,000 input rows**. [The template](../data/template.csv) shows the format.

The validator rejects missing, duplicate, or unsupported headers; malformed CSV; an invalid/mixed label column; conflicting duplicate transaction IDs; and excessive size or row count. It drops rows with a missing ID, invalid nonnegative integer step, or invalid finite nonnegative amount, and reports example row numbers. Identical repeated IDs are deduplicated. Missing or unseen merchant/category codes become `UNKNOWN` and are counted; the trained one-hot encoder ignores an unseen code instead of inventing a learned effect for it. If no valid rows remain, scoring stops. These rules are implemented in [`backend/app/validation.py`](../backend/app/validation.py).

If the `fraud` column is absent, the batch is **unlabeled scoring mode**: it can display scores and alerts, but cannot truthfully display precision, recall, a confusion matrix, or analyst-versus-ground-truth comparisons. If labels are present, they are used for *evaluation only* and never become model features or training examples.

### Why chronological splitting?

The distinct simulation days were sorted and allocated 60%/20%/20%: train days 0–107, validation 108–143, test 144–179. Whole days never cross splits. Row order within each day is retained. This is more honest for a time-oriented fraud task than randomly mixing later payments into training and earlier payments into testing. It reduces temporal leakage, though it does **not** prove there is no other entity or simulator-specific leakage. Customers or merchants may recur across time partitions; we do not claim an unseen-customer or unseen-merchant test. No class resampling was used, so the natural synthetic prevalence remains visible.

| Partition | Days | Rows | Fraud labels | Fraud prevalence |
|---|---:|---:|---:|---:|
| Train | 0–107 | 332,592 | 4,320 | 1.30% |
| Validation | 108–143 | 128,820 | 1,440 | 1.12% |
| Final test | 144–179 | 133,231 | 1,440 | 1.08% |

See [`ml/prepare_data.py`](../ml/prepare_data.py), [`data/README.md`](../data/README.md), and the exact [`manifest.json`](../ml/artifacts/manifest.json).

## 3. What the model actually learns

### Feature engineering and train-only preprocessing

Each row is reduced to exactly four source features:

| Feature | Transformation | Why used / caveat |
|---|---|---|
| `step` | numeric, standardized | Time within the simulator can carry a pattern; it may also encourage time-specific behavior that will not generalize. |
| `amount` | `log1p(amount)`, then standardized | Compresses a long-tailed amount scale while retaining order; handles zero safely. |
| `merchant` | one-hot encoded | Merchant patterns may matter; individual IDs can be dataset-specific. |
| `category` | one-hot encoded | Purchase type may matter; category frequencies and fraud rates are uneven. |

`log1p(x)` means `ln(1+x)`. It is a transformation, **not** an additional label or a currency conversion. `StandardScaler` learns numeric mean and scale on **training rows only**. `OneHotEncoder(handle_unknown="ignore")` learns merchant/category vocabulary on **training rows only**. A shared `ColumnTransformer` applies these same fitted operations to validation, final test, and uploads. Both candidates are trained on that same transformed matrix, so the comparison is fair at the feature/input level. The current LightGBM implementation uses this one-hot matrix too; it does **not** use LightGBM's native categorical feature mode.

The fitted matrix has **67 numeric columns**: two scaled values, 50 merchant indicators, and 15 category indicators. One-hot means one column per learned code, with the matching code set to 1 and others to 0. This is why an arbitrary merchant ID is not treated as an ordered number. Standardization is `(value − training mean) / training standard deviation`; the validation/test mean is never used to fit the scaler.

The model excludes `fraud` (target leakage), `transaction_id` (record key), `customer` (memorization risk and no history-based feature design), `age` and `gender` (sensitive demographics), and ZIP fields. Excluding sensitive fields does not prove absence of bias: merchant, category, or amount can still correlate with other attributes. The project does not run a demographic fairness audit. Feature construction lives in [`ml/features.py`](../ml/features.py); fitted preprocessing is saved in `preprocessor.joblib`.

### Candidate algorithms and fixed training settings

1. **Logistic regression baseline:** scikit-learn `LogisticRegression`, `solver="liblinear"`, `max_iter=1000`, `random_state=42`. It learns an additive linear relationship in *log-odds* after scaling and one-hot encoding. It is a strong, simpler baseline. It is not a selectable deployed model in this version.
2. **LightGBM challenger:** `LGBMClassifier` with 180 boosting estimators, 15 leaves, maximum tree depth 6, learning rate 0.05, minimum 100 samples per child, full row/column sampling, seed 42, and two training threads. Boosted trees can learn nonlinear thresholds and interactions that a plain additive logistic model may miss. The constrained tree settings keep the model relatively compact; they are not proof of optimal tuning.

Both use default class weighting; there is no oversampling, undersampling, SMOTE, or cost-sensitive training. The data are imbalanced, so model **ranking** and an operational threshold matter more than raw accuracy. We did not run a broad hyperparameter search or compare every possible algorithm. The exact training code is [`ml/train.py`](../ml/train.py).

Mathematically, logistic regression forms a weighted sum of transformed inputs and an intercept, `z = b + Σ(wᵢxᵢ)`, then maps it through `sigmoid(z)` to a score between 0 and 1. A coefficient changes the *log-odds* additively when its transformed input changes. LightGBM instead adds many small tree outputs, learning split-based nonlinearities and interactions; its binary output also maps a raw score through a logistic link. Because both receive the same 67-column encoding, a performance difference is attributable to the learning method/settings, not to one candidate receiving extra source fields. Both optimize classification objectives during fitting, while **AP and F1 are evaluation/selection measures** rather than directly optimized training losses.

### Threshold selection and why LightGBM was deployed

For each candidate, the validation rows are sorted by decreasing score. Candidate thresholds are considered only when the resulting alert rate is at most **5%** of validation transactions. Among those thresholds, choose the one with maximum F1; the implementation's sorted order favors a higher threshold in a tie. The 5% is a **ceiling on review workload**, not a target to flag exactly 5%. The chosen operating points flag about 1%.

The predetermined selection rule was: use LightGBM only if its validation **average precision (AP)** exceeds logistic AP by at least **0.02 absolute** *and* its recall at its own validation operating point is no lower. Otherwise use logistic regression. The observed AP gain was `0.902617 − 0.881162 = 0.021455`, and validation recall was `0.785417` versus `0.777083`; both conditions passed. Consequently, `selected_model=lightgbm` and its saved threshold is **0.3228891536**, displayed as about **32.3%**.

| Validation result | Logistic regression | LightGBM |
|---|---:|---:|
| Average precision (all ranking thresholds) | 0.8812 | **0.9026** |
| Chosen threshold | 0.4271 | **0.3229** |
| Alert rate at that threshold | 1.025% | **1.004%** |
| Precision | 0.8477 | **0.8747** |
| Recall | 0.7771 | **0.7854** |
| F1 | 0.8109 | **0.8277** |

Important distinction: **AP assesses the ranking over thresholds**, while precision, recall, and F1 above are measured at *one* selected threshold. A displayed score of 0.32 does not mean a verified 32% real-world chance of fraud. `predict_proba` is exposed as the model's ranking score; no real-world calibration study was performed.

### Untouched final test: the honest outcome

After model and thresholds were fixed, [`ml/evaluate.py`](../ml/evaluate.py) evaluated both saved candidates on all 133,231 later-day test rows and stored immutable Model Lab data. The script refuses to rerun over an existing artifact, reducing accidental repeated test tuning. It also records sampled PR/ROC points and global importance for the selected model. The full test was **not** used to switch models or adjust threshold after seeing these numbers.

| Final test at each candidate's validation threshold | Logistic regression | LightGBM, deployed |
|---|---:|---:|
| Average precision | 0.8939 | **0.9134** |
| ROC AUC | 0.9974 | **0.9983** |
| Precision | 0.8647 | **0.9002** |
| Recall | **0.7813** | 0.7646 |
| F1 | 0.8209 | **0.8269** |
| Alert count / rate | 1,301 / 0.976% | **1,223 / 0.918%** |
| True positive / false positive | 1,125 / 176 | **1,101 / 122** |
| False negative / true negative | 315 / 131,615 | 339 / 131,669 |

**Say the tradeoff plainly:** LightGBM reduced false alarms by 54 and sent 78 fewer alerts, but missed 24 more frauds than logistic at their respective saved thresholds on this final synthetic period. Its AP, precision, and F1 were higher. The validation rule still correctly explains why it is deployed; changing that rule after looking at the test would contaminate the final test. A future version could make the review-cost preference explicit and evaluate it on a *new* holdout period.

The currently deployed app loads only the selected LightGBM for scoring and explanation. Model Lab's logistic card shows a **historical comparison**, not a button to switch the live queue. Supporting a true switch would require separate scoring, thresholds, case explanations, and review-state handling. See [`backend/app/scoring.py`](../backend/app/scoring.py) and [`frontend/src/pages/ModelLab.tsx`](../frontend/src/pages/ModelLab.tsx).

## 4. Metrics every presenter must be able to explain

| Term | Meaning | Formula / interpretation |
|---|---|---|
| TP | Fraud labeled `1` and flagged | Caught labeled fraud. |
| FP | Legitimate labeled `0` but flagged | False alarm, consumes review effort. |
| FN | Fraud labeled `1` but not flagged | Missed labeled fraud. |
| TN | Legitimate labeled `0` and not flagged | Correctly left unflagged. |
| Precision | Share of alerts that are fraud | `TP / (TP + FP)`; if no alerts, app reports 0. |
| Recall / TPR | Share of frauds caught | `TP / (TP + FN)`; if no positive labels, app reports 0 at the threshold. |
| F1 | Harmonic mean of precision and recall | `2PR / (P + R)`; one compromise, not a universal business objective. |
| False-positive rate | Share of legitimate rows flagged | `FP / (FP + TN)`; ROC horizontal axis. |
| Alert rate | Share of **all** rows flagged | `(TP + FP) / N`; operational workload. |
| Prevalence | Share of labeled fraud rows | `(TP + FN) / N`; random-ranking PR baseline. |
| Average precision (AP) | Summary of precision as recall increases over score cutoffs | scikit-learn's weighted average of precision at recall increments; **not** simply trapezoidal PR area. |
| ROC AUC | Ranking discrimination over TPR/FPR cutoffs | Can look high even when rare-class alert precision is operationally weak. |

Why not headline **accuracy**? On the final test, around 98.9% of rows are legitimate. A model saying “legitimate” for every row would have high accuracy while catching zero fraud. AP and the precision–recall curve focus more directly on the rare positive class. AP's random baseline is approximately prevalence (about 1.08% on final test), though the measured AP near 91% reflects this *synthetic dataset*, not guaranteed performance elsewhere.

The saved threshold and fixed final-test metrics are one story. **Current batch metrics** are a separate story calculated from only the uploaded rows, if labels exist. Moving the threshold slider reclassifies saved batch scores and recomputes TP/FP/FN/TN; it does not change the model or the saved default. Avoid reporting a slider-adjusted batch number as the locked full-test result.

### The bundled 2,000-row sample

The demo sample takes **evenly spaced positions** from all 36 final-test days, without choosing rows by label or model score. It has 20 known frauds (1.00% prevalence). At the LightGBM saved threshold it produces 16 alerts: **TP 15, FP 1, FN 5, TN 1,979**, precision 93.75%, recall 75.0%, F1 83.33%, and AP 92.31%. These are *sample* figures, not the 133,231-row full-test figures. Because sampling changes class and difficulty mix, do not extrapolate its 93.75% precision to a bank. The sample is generated by [`ml/build_demo_sample.py`](../ml/build_demo_sample.py).

For a chalkboard calculation, sample precision is `15 / (15 + 1) = 93.75%`: 15 of 16 alerts have a known fraud label. Sample recall is `15 / (15 + 5) = 75%`: 15 of 20 known frauds were caught. The 1,979 TN values dominate the sample count but do not make the five misses disappear. These fractions refer only to the supplied synthetic labels.

### The Blind Spots view: validation analysis, not test tuning

[`ml/build_error_analysis.py`](../ml/build_error_analysis.py) scores the saved validation partition and groups errors by five equal-frequency amount bands, purchase category, and three 12-day periods. At the saved threshold it reports **1,293 alerts, 1,131 TP, 162 FP, 309 FN, 127,218 TN**. Its workload curve takes several score cutoffs and plots actual alert counts against caught fraud; tied scores are recounted exactly. Six highest-scoring missed validation frauds below the threshold provide anonymous teaching examples (amount, category, day, score).

The main finding is a **low-amount blind spot**: across the lower four amount bands, only **25 of 120** known frauds were caught (20.8% recall), compared with **1,106 of 1,320** in the highest band (83.8%). This does **not** prove “low amount causes fraud to be missed.” The bands have different fraud counts, and learned category/merchant patterns may interact with amount. It is a hypothesis for a future model, perhaps using past-only customer behavior, to test on a new temporal holdout. Category slices with zero fraud have undefined recall and are omitted from the recall chart. This analysis was generated *after* the locked model choice, but uses validation only and does not change the model.

## 5. Explaining a score without overstating it

LightGBM's built-in `pred_contrib=True` produces one contribution for each transformed feature plus a baseline. The implementation groups one-hot columns back into four readable factors: simulation day, amount, merchant, and purchase category. For a row:

```text
raw log-odds = baseline + contribution(day) + contribution(amount)
             + contribution(merchant) + contribution(category)
model score  = sigmoid(raw log-odds) = 1 / (1 + exp(-raw log-odds))
```

The backend checks that this reconstructed score matches `predict_proba` within numerical tolerance. A **positive** factor pushes the model's raw score up relative to its baseline; a **negative** factor pushes it down. Contributions are in **raw log-odds units**, not percentage points, and are *model attribution*, not causal evidence. The short English summary is deterministic template text based on contribution sign and magnitude; there is **no LLM** in the explanation path. A high score might result from several small contributions rather than one decisive reason. See [`backend/app/explanations.py`](../backend/app/explanations.py) and its tests.

The global importance chart in Model Lab is different from one-case explanation: it averages the **absolute** raw-score contribution over the first 2,000 chronological final-test rows, then groups by source feature. Current values are approximately category 1.533, merchant 0.417, amount 0.221, day 0.082. These magnitudes indicate how strongly this saved model's score moved in that reference sample; they do not measure causal importance or fairness.

**What-if** makes an edited copy of one transaction (amount, day, merchant, or category), validates it, and scores it through the **same saved model and preprocessor**. It compares signed factor contributions with the original, and tells whether the hypothetical score would exceed the *saved* threshold. It does not edit the uploaded batch, persist a new transaction, retrain, or prove that changing that field would change real-world fraud. `UNKNOWN` is used for unseen merchant/category values.

## 6. How the application works end to end

### Runtime architecture

The browser is React 19 + TypeScript + Vite; charts use Recharts, motion uses Framer Motion, and PDF creation uses `pdf-lib`. The backend is FastAPI with pandas, NumPy, scikit-learn, and LightGBM. A multi-stage Docker image builds the frontend, installs pinned Python dependencies, copies compact artifacts and sample files, and serves **frontend and API from the same FastAPI service** on Render. The full 594,643-row training CSV is not shipped in the container. Render checks `/api/health`. There is no user account, transactional database, external model API, or LLM dependency.

At startup, [`ScoringService`](../backend/app/scoring.py) loads the saved manifest, preprocessor, selected model, fixed Model Lab JSON, and validation-analysis JSON. It checks feature names and analysis version. For an upload, the server reads at most the byte cap plus one byte, validates/normalizes rows, builds the four model features, transforms with the saved preprocessor, calls `predict_proba`, and returns each valid row's score plus bounded summary data. The backend adds current-batch metrics only when labels exist. The batch response includes a SHA-256 hash of normalized rows, which scopes browser-local review decisions together with model version. The server does not store uploaded rows or decisions.

| Endpoint | Main use |
|---|---|
| `GET /api/health` | Service/model availability and version. |
| `GET /api/meta` | Schema, known codes, limits, deployed model, threshold. |
| `GET /api/template.csv`, `/api/demo.csv` | Blank upload template and attributed sample. |
| `GET /api/model-lab` | Saved full-test candidate evidence and selected-model importance. |
| `GET /api/validation-analysis` | Saved validation-only slices and workload curve. |
| `POST /api/batches/score` | Stateless bounded CSV validation, scoring, EDA, optional evaluation. |
| `POST /api/explain` | On-demand model contributions for one canonical row. |
| `POST /api/what-if` | Hypothetical rescore and explanation, including saved-threshold alert decision. |

### Views and what each teaches

1. **Intake:** sample load or CSV upload; template and clear validation errors. A “Service connected” badge means health responded, not that a bank is connected.
2. **Overview:** row counts, default alerts, fraud count only if labels exist, activity/category/amount/score charts, cleaning counts, and client-generated PDF report.
3. **Alerts:** ranked scores above the adjustable threshold, queue filters, 100-row pagination, exact batch metrics where labels exist, illustrative penalty points, and browser-local review statuses. Known labels are hidden by default; explicit reveal compares decisions to the supplied labels. Reviews are **not** training labels and do not alter model metrics.
4. **Case detail:** transaction fields, risk indicator, exact signed model factors, plain-English summary, review buttons, and what-if comparison. Explanation is requested on demand, rather than bulk-computed for 20,000 rows.
5. **Blind Spots:** immutable validation-only amount/category/time recall, review-workload tradeoff, and near-threshold missed examples.
6. **Model Lab:** static full-test logistic-versus-LightGBM cards and selected LightGBM PR/ROC/confusion/importance; below that, **separate current-batch metrics** when labels are supplied. Cards are comparisons, not model-selection controls.
7. **Replay:** orders already-scored rows by simulation day, preserving input order within a day, and animates them at 1×/5×/20×. Pause/restart change playback only. Final sample totals should be 2,000 processed and 16 default alerts.

Only review decisions persist in this browser's `localStorage`, keyed by batch hash and model version; they can be reset. The batch and uploaded file are in browser memory and disappear on refresh. The PDF reports active batch totals, labels/metrics if available, review counts, model version, and attribution. It is not an official fraud finding. A one-class labeled upload can show confusion counts and applicable threshold measures, but AP/ROC AUC are unavailable because ranking both classes cannot be measured.

## 7. Reproduction, verification, and safe change procedure

The public demo runs at [signal-fraud-workbench.onrender.com](https://signal-fraud-workbench.onrender.com/). For local setup, follow [`README.md`](../README.md): Python 3.14.7, Node 22+, `uv`, pinned [`backend/requirements.txt`](../backend/requirements.txt), and `npm ci`. Start Uvicorn on port 8000 and Vite on port 5173, or build the frontend and use the one-service Docker path.

To reproduce offline artifacts from the original dataset:

```bash
# Download source as described in data/README.md, then verify its SHA-256.
.venv/bin/python ml/inspect_data.py --input data/raw/bs140513_032310.csv --output data/source_profile.json
.venv/bin/python ml/prepare_data.py --input data/raw/bs140513_032310.csv --output data/processed
.venv/bin/python ml/train.py --data data/processed --output ml/artifacts
.venv/bin/python ml/evaluate.py --data data/processed --artifacts ml/artifacts
.venv/bin/python -m ml.build_error_analysis
```

**Do not run those train/evaluate commands over the versioned artifact directory.** They deliberately reject existing artifacts. To experiment, copy the project or use a fresh output directory and a new documented model version. `build_demo_sample.py` can refresh only the deterministic demo slice without reevaluating the final test. Before presenting, run `.venv/bin/python -m pytest backend/tests -q` (14 tests at the last acceptance) and `cd frontend && npm run build`. Tests check chronological boundaries, saved validation score references, the selection rule, score/explanation reconstruction, API/data behavior, and validation-slice totals. The last public acceptance included sample scoring, the guided flow, mobile view, replay, a generated PDF, and a synthetic 20,000-row upload (HTTP 200; 210 alerts; about 4.36 seconds on that run). The free host may sleep and take roughly a minute to wake.

If a teacher asks for “live training,” show the training script and saved manifest; **do not run retraining during a presentation** or imply upload labels teach the model. If they ask for a different dataset, explain that the contract is BankSim-format and a new real-world dataset requires permission, schema mapping, leakage review, a fresh temporal split, training, calibration, and independent evaluation.

## 8. A five-minute presentation narrative

The [click-by-click demo script](DEMO_SCRIPT.md) is a rehearsal aid. This shorter narrative assigns the point of each transition. One person can present it; a team can split sections without changing the claims.

| Time | Action | Say, in your own words |
|---|---|---|
| 0:00–0:35 | Open sample and Overview | “We trained offline on earlier synthetic days. This is an evenly spaced 2,000-row slice of later held-out days; 20 rows have fraud labels.” |
| 0:35–1:30 | Alerts, open a case, decide blind, reveal | “Sixteen cross the saved threshold. The score prioritizes a human review. These bars explain this model's raw score, not why fraud happened. Our analyst decision is separate from the known label.” |
| 1:30–2:05 | Threshold and cost scenario | “Moving this control reclassifies the same scores. More alerts can catch more fraud but consume more review time. Penalty points are illustrative.” Reset threshold. |
| 2:05–2:35 | What-if | “An edited copy goes through the same model. We can see the new score and exact contribution changes; nothing is retrained.” |
| 2:35–3:25 | Blind Spots | “Validation showed 25 of 120 lower-band frauds caught, versus 1,106 of 1,320 in the highest band. Aggregate F1 hides this weakness.” |
| 3:25–4:25 | Model Lab | “Validation selected LightGBM. The untouched final test independently measured both candidates. LightGBM improved AP/precision/F1 but logistic had slightly higher recall at its threshold. Current-batch results below are a different sample.” |
| 4:25–5:00 | Replay, then report if time | “This is playback of already-scored simulation days, not a streaming bank feed.” Show 2,000 processed/16 alerts and mention the PDF attribution. |

Before the talk, open the public URL to wake Render, confirm **Service connected**, and keep `data/sample_labeled.csv` plus the local run instructions as fallback. Never upload real customer records to this public prototype. Each teammate should be able to explain at least the split, features, selection rule, confusion matrix, and LightGBM-versus-logistic tradeoff without reading from the screen.

## 9. Teacher questions: clear answers and traps to avoid

| Likely question | Answer grounded in this project |
|---|---|
| What exactly is the ML task? | Binary classification/ranking: given four transaction features, produce a score used to rank cases for fraud review. A threshold converts scores into alerts. |
| Where do labels come from? | BankSim supplies synthetic `fraud=0/1` labels. Upload labels, if any, are used to evaluate that batch, never to train the deployed model. |
| Why a synthetic dataset? | It is shareable for a college noncommercial demo and has labels/time steps. Its patterns and performance are not evidence of real-bank reliability. |
| Why not a random split? | A random split can train on later simulator behavior and test on earlier behavior. Whole-day chronological partitions better mimic deployment into later periods. They do not eliminate all possible leakage. |
| What is data leakage here? | Information unavailable when scoring or drawn from the evaluation future entering training/selection. We exclude `fraud` from features, fit preprocessing only on train, select on validation, and lock the final test. Repeated entities and simulator structure remain possible caveats. |
| Why only four features? | They exist in the input contract and can be scored consistently; we avoided direct customer memorization and demographic fields. The price is less behavioral context, especially for low-amount fraud. |
| Why `log1p(amount)`? | Amounts are long-tailed; the log compresses very large values while keeping zero valid. The scaler is fitted on train only. |
| Why one-hot encoding? | Models need numeric inputs for categorical codes. One-hot avoids giving arbitrary numeric order to merchants/categories; unseen values activate no learned category column. |
| Why two models? | Logistic regression is a transparent additive baseline. LightGBM tests whether boosted-tree nonlinearities and interactions materially improve ranking. |
| What are boosted trees? | A sequence of shallow decision trees, each added to improve the ensemble's objective. The final score combines their outputs and passes through a logistic link for binary classification. |
| Did we tune hyperparameters extensively? | No. We used a fixed compact LightGBM configuration and a simple logistic baseline, then a stated validation rule. We should not claim exhaustive optimization. |
| How did you address class imbalance? | We preserved prevalence, reported AP/PR and precision/recall, limited review workload, and selected thresholds on validation. We did not balance classes through sampling or weights. |
| Why not accuracy? | Predicting every row legitimate would look about 99% accurate on this rare-fraud dataset while missing all frauds. |
| What does AP mean? | Average precision summarizes ranking quality across recall changes. It is not the precision at the saved threshold and is not exactly trapezoidal PR area. |
| Why is the PR curve emphasized? | Its precision axis reveals false-alert burden when positives are rare; ROC AUC can appear excellent even if an operating point is not useful to analysts. |
| Why is the threshold 32.3%? | Validation F1 was maximized among thresholds flagging no more than 5% of rows. 32.3% is a model-score cutoff, not a verified fraud probability. |
| Why not simply select logistic for its higher final-test recall? | The predeclared validation selection rule chose LightGBM before the final test. Changing after seeing the test would use it as another validation set. We disclose the recall tradeoff and would test a revised objective on new held-out data. |
| Why can’t I click LR in Model Lab? | The card is an offline comparison. Live scoring and the explanation endpoint load the selected LightGBM. A switch would need a separately coherent model/threshold/explanation path. |
| Why are full-test and demo numbers different? | The demo is only 2,000 evenly spaced positions from 133,231 test rows, with a different composition. Its confusion counts must not be sold as full-test results. |
| Are the scores calibrated probabilities? | Not for real banking. `predict_proba` gives a model score on BankSim; no real-world calibration or deployment study was done. |
| Is the explanation SHAP? | LightGBM `pred_contrib=True` gives TreeSHAP-style signed contributions in raw log-odds. We group encoded columns by source feature and verify their sum reconstructs the score. It is not a causal explanation. |
| Why does the category dominate importance? | In the saved model/reference slice its mean absolute contribution is largest. That may reflect simulator structure and uneven categories; it does not prove category causes fraud or generalizes to banks. |
| What is the most important model failure? | Validation recall for the lower four amount bands is 25/120 (20.8%). It suggests missing context, not a proven causal defect. |
| Does clicking “confirmed fraud” train the model? | No. It stores a browser-local analyst review status. Source labels and model metrics remain separate. |
| What happens with an unlabeled CSV? | It receives scores, alerts, and summaries. Ground-truth metrics and reveal/comparison are unavailable. |
| What if a category or merchant is new? | It becomes `UNKNOWN`; the encoder ignores unseen categories. The UI reports how many rows were mapped. Model behavior on a different schema remains unvalidated. |
| Is replay real-time fraud detection? | No. It replays an already-scored, time-ordered batch in the browser. Pause and speed do not invoke the model again. |
| Is the cost calculator a money forecast? | No. Its user-chosen penalty points illustrate FP/FN tradeoffs on a labeled batch. There is no bank loss dataset or real currency assumption. |
| What would production require? | Representative permissioned data; security/privacy and access controls; entity and temporal leakage checks; calibration; a chosen business workload/cost objective; monitoring/drift review; human governance; and independent evaluation before any decision use. |
| How reproducible is it? | Source URL, license, SHA-256, split manifest, feature schema, fixed seed/settings, package versions, saved models, reference validation scores, and tests are recorded. Full source is downloaded separately under its license. |

## 10. Source map and final reminders

| Need to inspect | File |
|---|---|
| Dataset inspection and split | [`ml/inspect_data.py`](../ml/inspect_data.py), [`ml/prepare_data.py`](../ml/prepare_data.py) |
| Features, fitting, validation rule | [`ml/features.py`](../ml/features.py), [`ml/train.py`](../ml/train.py), [`ml/artifacts/manifest.json`](../ml/artifacts/manifest.json) |
| Fixed final evaluation | [`ml/evaluate.py`](../ml/evaluate.py), [`ml/artifacts/model_lab.json`](../ml/artifacts/model_lab.json) |
| Validation errors | [`ml/build_error_analysis.py`](../ml/build_error_analysis.py), [`ml/artifacts/validation_analysis.json`](../ml/artifacts/validation_analysis.json) |
| Upload contract, score, explanation | [`backend/app/validation.py`](../backend/app/validation.py), [`backend/app/scoring.py`](../backend/app/scoring.py), [`backend/app/explanations.py`](../backend/app/explanations.py) |
| API and app | [`backend/app/api.py`](../backend/app/api.py), [`frontend/src/app/App.tsx`](../frontend/src/app/App.tsx) |
| Tests and presentation path | [`backend/tests/`](../backend/tests), [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md) |

**The three claims to protect in every presentation:** (1) this is synthetic BankSim decision support, (2) model/threshold selection used validation and the final test stayed an evaluation, and (3) model scores, explanations, analyst decisions, and known fraud labels are different kinds of information. If a number is from a different set or threshold, name that set and threshold before quoting it.
