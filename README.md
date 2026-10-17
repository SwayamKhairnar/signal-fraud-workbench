# Signal - Banking Fraud Analyst Workbench

Signal is a college AIML demonstration of **batch fraud decision support** on the synthetic [BankSim dataset](https://www.kaggle.com/datasets/ealaxi/banksim1). It scores a documented CSV with a saved offline model, ranks alerts, explains each selected score, compares models, and replays transactions in simulation order. The app does not train on uploaded files or make real banking decisions.

## Try the local demo

Requirements: Python 3.14.7, Node.js 22+, [uv](https://docs.astral.sh/uv/). From the project root:

```bash
uv python install 3.14.7
uv venv --python 3.14.7 .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt
cd frontend && npm ci
```

Start the API from the project root:

```bash
.venv/bin/python -m uvicorn backend.app.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`, choose **Explore sample batch**, then use Overview, Alerts, Model Lab, and Replay. Open an alert to inspect model contributions, record a browser-local review decision, and try a what-if edit. The Overview can download a PDF report. The sample is a fixed 2,000-row chronological slice of the final test period and contains 20 fraud labels. Its default threshold yields 14 alerts.

## CSV contract

Download the template in the app or inspect [data/template.csv](data/template.csv). Required columns are `transaction_id,step,merchant,category,amount`; optional `fraud` must be `0` or `1` for every row. UTF-8 CSV is required. The current cap is 5 MB and 20,000 input rows. Invalid rows, duplicate IDs, and unseen codes are reported. Compatible unlabeled files receive scores and alerts without invented fraud metrics. Uploaded rows are processed in memory and not stored on the server.

## Model and evidence

The saved model is LightGBM, selected against logistic regression on a validation period. The chronological split is train days 0-107, validation 108-143, and untouched final test 144-179. On the full final test, the selected model has average precision 0.913, precision 0.900, recall 0.765, and F1 0.827 at the validation threshold. The model score ranks synthetic transactions; it is not a calibrated real-world fraud probability. Details are in [ml/MODEL_CARD.md](ml/MODEL_CARD.md), [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md), and [data/README.md](data/README.md).

The BankSim source is licensed CC BY-NC-SA 4.0. The full downloaded CSV and derived train/validation/test files are omitted from Git; the small labeled demo sample is included with attribution. To reproduce training, download the source CSV from the Kaggle dataset into `data/raw/bs140513_032310.csv`, verify its SHA-256 against `ml/artifacts/manifest.json`, then use the scripts in order:

```bash
.venv/bin/python ml/inspect_data.py --input data/raw/bs140513_032310.csv --output data/source_profile.json
.venv/bin/python ml/prepare_data.py --input data/raw/bs140513_032310.csv --output data/processed
.venv/bin/python ml/train.py --data data/processed --output ml/artifacts
.venv/bin/python ml/evaluate.py --data data/processed --artifacts ml/artifacts
```

Existing artifacts are guarded against accidental overwrite or repeat final-test evaluation. Reproduction should use a fresh copy of the project or explicitly archive the saved artifacts first.

## Checks

```bash
.venv/bin/python -m pytest backend/tests
cd frontend && npm run build && npm audit
```

The API serves the built frontend from `frontend/dist` at `/` when that folder exists. For a single local service, run `npm run build` in `frontend`, then start Uvicorn and open `http://localhost:8000`.

## Docker and deployment

```bash
docker build -f deploy/Dockerfile -t signal-fraud-workbench .
docker run --rm -p 8000:8000 signal-fraud-workbench
```

The root [render.yaml](render.yaml) defines one Docker web service on Render's free plan with `/api/health` as the health check. A public URL is added only after deployment and verification. Free instances can sleep after inactivity, so warm the link before a live presentation. Keep public uploads synthetic; this prototype has no accounts or multi-user case storage. Analyst review decisions stay in the browser under a versioned batch-and-model key and can be reset from Alerts.

## Project documents

The original instructions are preserved in [PROJECT_BRIEF.md](PROJECT_BRIEF.md). The approved final brief is in [STAGE_A_REVIEW.md](STAGE_A_REVIEW.md), the numbered plan in [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md), current status in [PROGRESS.md](PROGRESS.md), and a click-by-click presentation script in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).
