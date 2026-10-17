# Banking Fraud Transaction Detection System

An AIML Continuous Internal Evaluation (CIE) project.

> **Note to the AI:** This document is a project brief, not a final specification. Read Section 9, "Your Role and Instructions for the AI", before doing anything else. It defines your role and the stages you must follow.

---

## 1. What We Are Building

A web-based **fraud analyst workbench for banks**. A bank uploads a day's worth of transactions as a properly formatted CSV. The system cleans the data, runs automatic exploratory analysis, scores every transaction with a **pre-trained machine learning model**, flags the suspicious ones, and explains *why* each one was flagged.

The system is a **decision-support prototype**, not a production banking system. It helps a human fraud analyst review transactions faster and with more understanding.

### The core idea in one paragraph

Banks process very large numbers of transactions every day and only a tiny fraction are fraudulent. Analysts cannot review everything by hand. Our system takes a batch of transactions, ranks them by fraud risk, flags the risky ones, and shows the reasons behind every flag in plain English, along with a clear, animated view of how the models behave and how well they perform.

---

## 2. Main Goal and Desired Outcome

**Main goal:** Demonstrate a complete, end-to-end, explainable fraud detection pipeline, from raw file to flagged transaction with reasons, wrapped in a clean and visually impressive interface.

**Desired outcomes:**
- A bank user can upload a transaction file and see flagged transactions with risk scores and reasons.
- Every flagged transaction has a human-readable explanation (top contributing factors).
- Model performance is visible and easy to understand: precision, recall, F1, confusion matrix, ROC and PR curves, and model comparison.
- The UI makes ML concepts *visible* through smooth animations rather than static tables.
- The whole system is **deployed and accessible via a live link**, so it can be demonstrated end-to-end without running anything locally.

---

## 3. Key Design Decision: Pre-Trained Model, Scoring Only

We are building the **pre-trained scoring** version. We are *not* training a model on whatever the user uploads.

**Why:**
- Real daily bank transactions have **no fraud labels**. Fraud is confirmed days or weeks later. Without labels, training and metrics are impossible on uploaded data.
- Fraud features depend on specific columns, so arbitrary schemas would break the pipeline.
- Training live in a demo is slow and risky.
- This mirrors how real banks operate: training happens offline, production only scores.

**How it works:**
1. **Offline:** Models are trained and compared once on a labeled dataset. The best models are saved.
2. **Online:** The app loads the saved models and scores uploaded batches.

### Two usage modes

| Mode | Input | Output |
|---|---|---|
| **Scoring mode** | Unlabeled CSV in the required format | Cleaned data, EDA, risk scores, flagged transactions, explanations |
| **Evaluation / Replay mode** | Labeled CSV (e.g. a held-out test split) in the required format | Everything above, plus confusion matrix, precision/recall/F1, ROC/PR curves, threshold analysis |

For demos, a held-out test split acts as "the bank's day of transactions" so that every feature, including metrics, is available.

---

## 4. Core Features

### 4.1 Data upload and validation
- Upload a CSV matching a documented template (a downloadable sample file is provided).
- Validate columns and types, with clear and friendly error messages.
- Basic cleaning: missing values, duplicates, invalid amounts, type fixes.

### 4.2 Automatic EDA
- Fraud vs non-fraud proportions (when labels exist)
- Amount distributions, transaction types, activity by hour or day
- Suspicious patterns highlighted visually

### 4.3 Fraud scoring and flagging
- Every transaction gets a risk score.
- Flagged transactions appear in a prioritized queue, highest risk first.

### 4.4 Explainability (a priority feature)
- For each flagged transaction, show the top reasons it was flagged, in plain English (e.g. "Amount is unusually high for this transaction type", "Sender balance was fully drained").
- Global view of which features matter most across the model.

### 4.5 Model Lab (pre-computed)
- Side-by-side comparison of the models trained offline.
- Metrics, curves and feature importance for each model.
- Pre-computed so it loads instantly and never fails in a demo.

### 4.6 Replay mode
- A **replay button** that plays transactions back in time order, like a live feed.
- Speed controls (pause, 1x, 5x, 20x).
- Flagged transactions pop in as they occur, with running counters and metrics updating live.
- This is playback over already-scored data, not real streaming infrastructure.

### 4.7 Analyst workflow
- Analyst can mark each flagged transaction as "confirmed fraud" or "false alarm".
- Simple case drill-down view per transaction.

### 4.8 Wow-factor features
- **Threshold slider:** moving it updates precision, recall, F1 and a "fraud caught vs false alarms" cost view in real time.
- **What-if simulator:** edit a transaction's amount, time or type and watch the risk score and reasons change.
- **Exportable report** (PDF) summarizing a processed batch.

---

## 5. UI and Animation Requirements (High Priority)

The interface is a major part of the evaluation. It must feel polished and modern, not like a default dashboard.

- **Clean, minimal, professional design**, suitable for a banking context (dark and light theme is a plus).
- **Animated visualizations of ML concepts:** confusion matrix filling up, ROC/PR curves drawing themselves, metrics counting up, feature importance bars growing, the threshold slider reshaping results live.
- **Smooth transitions** between pages and states; skeleton loaders instead of blank screens.
- **Replay view** should feel like a live monitoring console.
- Every metric should have a short tooltip or one-line explanation so that a non-ML person understands it.
- Responsive layout; works well on a projector for the demo.

---

## 6. Constraints

- **Hardware:** The development machine cannot train on a very large dataset (a previous attempt with a ~6.3 million row dataset was not feasible). The dataset choice and training strategy must work on a normal laptop. Use sampling, stratification, lighter models or any other sensible technique.
- **Class imbalance:** Fraud is rare. Accuracy alone is misleading, so evaluation must focus on precision, recall, F1 and PR-AUC. Use a **time-based split** (not random) to avoid leakage, and apply any resampling to the training portion only.
- **Scale claims:** Do not claim "millions of transactions in real time". Position it as batch scoring of up to a few hundred thousand rows.
- **Keep the ML explainable.** Prefer models whose predictions can be explained clearly. Avoid complex deep learning unless there is a strong justification.
- **Must be deployable** on free or low-cost hosting.

---

## 7. Suggested Tech Stack (Starting Point)

These are suggestions for the reviewing AI to confirm or improve.

| Layer | Suggestion |
|---|---|
| Frontend | React (Vite) with a charting library and an animation library (e.g. Framer Motion) |
| Backend / ML service | Python with FastAPI |
| ML | scikit-learn, XGBoost or LightGBM, SHAP for explanations |
| Data | pandas |
| Storage | SQLite or PostgreSQL for flagged cases and analyst feedback |
| Deployment | Frontend on Vercel or Netlify; backend on Render, Railway or Hugging Face Spaces; Docker for packaging |

Candidate models for offline comparison: Logistic Regression (baseline), Random Forest, XGBoost/LightGBM, and Isolation Forest (unsupervised anomaly view). Final choice is left to the reviewing AI.

---

## 8. Out of Scope

- True real-time streaming infrastructure (Kafka etc.)
- Training on user-uploaded data inside the app
- Multi-tenant accounts, authentication and role management
- Graph neural networks and LLM chatbots
- Any claim of being production-ready or bank-certified

---

## 9. Your Role and Instructions for the AI

**You (the AI reading this) are the lead architect and the primary builder of this project.** The human (a student) will run your instructions and code, paste back results and errors, and make final decisions at checkpoints. You are responsible for taking this project from this brief all the way to a deployed, working product.

Work in the following stages, in order. **Do not skip ahead.** At the end of each stage, stop, summarize, and wait for the human to confirm before moving on.

### Stage A: Review the brief
1. Read and critique this brief. Identify weaknesses, risks, missing pieces and unrealistic assumptions.
2. Write your own improved version, keeping the project's intent (fraud detection workbench with scoring, explainability, replay, and a standout animated UI) but improving scope, structure and feasibility.
3. Compare the two versions, state clearly which is better and why, and merge the best ideas into one **final brief**.
4. **Checkpoint:** Show the final brief and wait for approval.

### Stage B: Technical specification
Produce the full technical specification. You make all technical decisions, including:
- Dataset choice (must be trainable on a normal laptop; justify it and explain any sampling)
- Preprocessing and feature engineering
- Models to train, training approach and evaluation method
- Explainability approach
- API design, database schema, and project folder structure
- Frontend pages, components, and an animation plan for each ML visualization
- Deployment architecture

**Checkpoint:** Wait for approval. Confirm the dataset and sampling plan with the human specifically.

### Stage C: Implementation guide (the master plan)
Write a single `IMPLEMENTATION_GUIDE.md` that breaks the entire project into **numbered phases**. Each phase must include:
- **Goal:** what exists at the end of the phase
- **Tasks:** small, ordered, concrete steps
- **Files to create or change**
- **How to run and test it:** exact commands
- **Definition of done:** a checklist the human can verify
- **Demo-ability:** what can be shown at this point

Suggested phase shape (adjust as you see fit):
1. Project setup and repo structure
2. Dataset preparation and offline model training
3. Model evaluation and saving artifacts
4. Backend API (upload, validate, clean, score, explain)
5. Frontend foundation (layout, design system, theme)
6. Upload and EDA pages
7. Flagged queue and per-transaction explanations
8. Model Lab page with animated metrics
9. Replay mode
10. Threshold slider, what-if simulator, analyst workflow, report export
11. UI and animation polish
12. Testing, bug fixing, and demo rehearsal data
13. Deployment (end-to-end, public link)

### Stage D: Build, phase by phase
For each phase in the guide:
1. State which phase you are starting and what will exist at the end.
2. Give the code and commands in **small, copy-pasteable steps**, with full file contents (not fragments) wherever a file is created.
3. Tell the human exactly how to run and verify it.
4. **Stop and wait** for the human to report the result. Fix errors before moving on.
5. When the phase passes, mark it complete and move to the next.

### Working principles (vibe-coding rules)
- **Small steps, always working.** The project should run at the end of every phase. Never leave it half-broken across phases.
- **One phase at a time.** Do not generate the whole project in one go.
- **Walking skeleton first.** Get a thin end-to-end flow working early (upload, score, show result), then deepen and polish.
- **Simple over clever.** When there is a choice, pick the simpler option that still gives a polished, explainable result.
- **Explain briefly.** Each step gets a one or two line "what and why", so the student can explain the project in the viva.
- **Debug with evidence.** When the human pastes an error, find the root cause before changing code. Do not guess repeatedly.
- **Keep a progress log.** Maintain a `PROGRESS.md` (phases done, decisions made, known issues) and update it after each phase, so work can resume in a new chat.
- **Protect the demo.** Pre-compute anything slow. Ship sample data and a one-click demo path. The live demo must never depend on slow training or fragile steps.
- **Keep the codebase tidy.** Clear folder structure, readable names, a short README for running locally, and environment variables for configuration.
- **Deployment is part of the build,** not an afterthought. Verify early that the chosen free hosting can run the backend and the saved models, and flag any risk in Stage B.

### Final deliverables
- A deployed app with a public link
- Source code in a clean repository
- Sample dataset and downloadable CSV template
- Offline training notebook or script and saved model artifacts
- `README.md` (how to run), `IMPLEMENTATION_GUIDE.md`, and `PROGRESS.md`
- A short demo script (what to click, in what order, and what to say)

When anything is ambiguous, choose the simpler option that produces a polished, explainable and demonstrable result.
