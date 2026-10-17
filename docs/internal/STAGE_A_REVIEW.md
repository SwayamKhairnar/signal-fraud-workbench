# Stage A — Brief review and final project brief

## Review of the original brief

The original brief has a strong central idea: an analyst can upload a batch, inspect ranked fraud alerts and reasons, and demonstrate model behavior through replay and visualizations. Its distinction between unlabeled scoring and labeled evaluation is especially useful.

The following points need tightening before implementation:

1. **The dataset and input contract are unspecified.** The application needs one documented schema, units, allowed values, a sample CSV, and a clear policy for extra or missing columns. A generic bank CSV cannot be assumed to fit a trained model.
2. **Several promises depend on labels.** Fraud proportions, live precision and recall, ROC/PR curves, and threshold tradeoffs can only be calculated from a labeled evaluation batch. The scoring view must never imply that predicted flags are confirmed fraud.
3. **“Reasons” could become misleading.** Explanations must be derived from the actual saved model and the exact features used for scoring. Plain-English translations can simplify them, but must not claim causation or certainty.
4. **The feature list risks leakage.** Transaction features must be available at scoring time. Offline evaluation needs chronological splitting, training-only preprocessing, and a held-out test set that is not reused for model selection.
5. **Model comparison is broader than the demo needs.** Four model families, including an anomaly detector, may consume time while making comparison less clear. A simple baseline and one stronger candidate are enough for a defensible first version; further models are optional if evidence justifies them.
6. **The workload needs a measurable limit.** “A few hundred thousand rows” may be too large for a free hosted service once parsing, explanations, and charts are included. Batch size and file size limits should be tested and published, with sampling or aggregation for visualizations.
7. **Analyst decisions need a lifecycle.** “Confirmed fraud” and “false alarm” are analyst review outcomes, not ground-truth labels for evaluation. The brief should define storage, reset behavior, and how those decisions are distinguished from source labels.
8. **The feature list is ambitious for a student project.** Upload, cleaning, EDA, scoring, explanations, replay, model lab, what-if, feedback, PDF, responsive animation, and deployment can threaten the working core. A required path and optional additions will protect the demo.
9. **Deployment assumptions are unverified.** Free services may sleep, impose memory or file limits, or have restricted persistent storage. The deployment plan needs a tested fallback and a demo dataset bundled with the app.
10. **Data handling is absent.** The prototype should use synthetic or public data, avoid real customer information, validate uploads, and delete temporary raw files after processing unless retention is explicitly needed.

## Improved brief: changes to the original

The improved version below keeps the original intent but defines one supported CSV schema, two honest operating modes, a clear minimum demo path, testable success criteria, and limits on claims. It treats model explanations as evidence about a prediction, and separates optional polish from the end-to-end product.

| Area | Original brief | Improved brief | Why the change helps |
|---|---|---|---|
| Input | Properly formatted CSV, schema later | One versioned schema, template, validation and limits | Makes upload behavior predictable |
| Metrics | Broad list of metrics throughout | Metrics only for labeled evaluation data | Prevents misleading scoring results |
| Explanations | Top reasons in plain English | Model-derived contributions with limitations | Makes reasons faithful and defensible |
| Scope | All features presented as core | Required demo path plus stretch features | Keeps a complete product achievable |
| Evaluation | Time split and imbalance focus | Chronological split, untouched final test, training-only transforms | Reduces leakage and optimistic estimates |
| Demo | Public link and sample data | Public link, bundled replay batch, documented fallback | Improves reliability during presentation |

**Recommendation:** Use the improved brief. It preserves the analyst workbench and animated ML story while defining what can actually be demonstrated and verified. The final brief below merges the original's strongest ideas with these practical constraints.

---

# Final brief for approval

## 1. Product and audience

Build a web-based **banking fraud analyst workbench** for a college AIML demonstration. A user uploads a batch of transactions in one documented CSV format. The app validates and cleans the batch, scores every valid transaction with a model trained offline, ranks alerts by risk, and shows model-derived reasons for each alert. It is a decision-support prototype using public or synthetic data, not a production banking service.

## 2. Primary demo path

The public app opens with a one-click sample batch. A presenter can load it, see a short data-quality summary and exploratory charts, open a prioritized alert queue, inspect one alert and its reasons, adjust the alert threshold, and play the scored transactions in time order. The sample batch includes labels so the presenter can also open the Model Lab and show evaluation metrics and animated visualizations. A user can download the CSV template and upload their own compatible file.

## 3. Operating modes and terminology

- **Scoring mode:** An unlabeled CSV produces risk scores, threshold-based alerts, reasons, and descriptive batch charts. Alert counts and risk distributions are predictions, not confirmed fraud statistics. Precision, recall, F1, ROC/PR curves, and confusion matrix are hidden or explicitly unavailable.
- **Evaluation/replay mode:** A compatible CSV with an optional ground-truth fraud label produces the same scoring output plus metrics, threshold tradeoffs, and model evaluation charts. Replay follows the batch's transaction order and animates already-computed results. Running metrics appear only when labels are present.
- **Analyst review:** A reviewer may mark an alert as “confirmed fraud,” “false alarm,” or “needs review.” These are stored review decisions and remain distinct from labels supplied in the evaluation file.

## 4. Data and model contract

- Support one versioned CSV schema chosen in Stage B. Publish required columns, types, allowed categories, time representation, label definition, file limits, a blank template, and a small labeled demo file.
- Reject missing required columns with actionable messages. Record dropped or repaired rows and the reasons. Handle missing values, invalid numeric values, duplicates, and invalid categories by documented rules; never silently invent transaction facts.
- Train offline on a public or synthetic dataset that fits a normal laptop. Use chronological training, validation, and final test partitions. Fit imputers, encoders, resampling, and models using training data only. Select a threshold using validation data, then report final performance on the untouched test partition.
- Compare at least an interpretable baseline and one stronger model. Select a saved model based mainly on precision, recall, F1, PR-AUC, and the review workload at the chosen threshold. Report class prevalence alongside metrics. Accuracy may be shown only with context.
- Score uploads with the saved preprocessing and model artifacts. Do not train on uploaded batches. Show per-alert reasons generated from the selected model's actual input features and a global feature view. Explain that a feature contribution describes the model's prediction, not proof of fraud.

## 5. Required interface

1. **Batch intake:** sample-batch action, CSV upload, template download, validation errors, and cleaning summary.
2. **Overview:** total rows, valid rows, alert count, score distribution, amount/type/time charts, and labeled fraud proportion only when available.
3. **Alert queue and case detail:** sort by risk, filter by status, inspect transaction fields and top model-derived reasons, and record analyst decisions.
4. **Model Lab:** precomputed model comparison, metric definitions, confusion matrix, ROC and PR curves, and global feature view. Clearly identify the fixed offline test results versus metrics calculated for a labeled uploaded batch.
5. **Replay:** chronological playback of the scored batch, pause and speed controls, running counts, visible new alerts, and running evaluation metrics only for labeled batches.
6. **Threshold control:** immediately recalculate flags and, when labels exist, precision, recall, F1, false alarms, and fraud caught. A cost view requires explicit, editable assumptions rather than implying real banking costs.

## 6. Design and animation

Use a clean, responsive visual design suitable for a bank analyst and a projected college demo. Animate metric entry, confusion matrix counts, ROC/PR drawing, feature bars, threshold changes, and replay events. Keep animation smooth and restrained, respect reduced-motion settings, and provide text values so charts are understandable without motion. Give each metric a short plain-English definition. Show progress or skeleton states during processing.

## 7. Optional additions after the required path works

A what-if transaction editor, downloadable PDF batch report, dark theme, and extra model families can be added after the required path and deployment work. A what-if result must rerun the saved scoring pipeline and label the result as a hypothetical prediction. PDF export should summarize the processed batch and state whether metrics came from labels.

## 8. Quality, safety, and deployment

- Bundle sample data and precomputed model artifacts so the demo requires no training or external dataset download.
- Validate CSV type, size, schema, and row count. Set a measured upload limit during Stage B rather than promising an untested capacity. Aggregate large chart inputs and cap costly per-row explanations as needed while still providing reasons for alerts.
- Use public or synthetic transactions only. Do not upload real customer information. Avoid storing raw uploaded files beyond processing; document what review data persists and how to reset it.
- Deploy a working frontend and scoring service behind a public link. Test the actual hosting memory, startup, and persistence behavior early, and document a reliable demonstration path if the free service sleeps.
- Provide source code, training script or notebook, saved artifacts, sample/template CSVs, local setup README, implementation guide, progress log, and a short click-by-click demo script.

## 9. Acceptance criteria

The project is complete when a new user can open the public link, run the sample batch, inspect a scored alert and a faithful plain-English reason, adjust the threshold, watch replay, and understand the labeled evaluation charts. A compatible unlabeled CSV must score successfully without showing label-dependent metrics. Invalid uploads must return understandable errors. The documented local setup must reproduce the same core flow without training during app startup. Reported offline metrics must come from an untouched chronological test partition and state the dataset and class prevalence.

## 10. Explicit limits

This is batch decision support. It does not provide live bank integration, production security certification, true streaming, model retraining from uploads, or a promise of fraud detection performance on arbitrary banks. The only supported input is the documented schema; results on new distributions may differ from the offline evaluation.
