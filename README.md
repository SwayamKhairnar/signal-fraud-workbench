# Signal - Banking Fraud Analyst Workbench

Signal is a college AIML demonstration of **batch fraud decision support** on the synthetic [BankSim dataset](https://www.kaggle.com/datasets/ealaxi/banksim1). It scores a documented CSV with a saved offline model, ranks alerts, explains each selected score, compares models, and replays transactions in simulation order. The app does not train on uploaded files or make real banking decisions.

Source repository: [SwayamKhairnar/signal-fraud-workbench](https://github.com/SwayamKhairnar/signal-fraud-workbench).

Public demo: [signal-fraud-workbench.onrender.com](https://signal-fraud-workbench.onrender.com/). The free service can take roughly a minute to wake after inactivity; open it before presenting.

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

Open `http://localhost:5173`, choose **Explore sample batch**, and follow the optional five-step demo guide through Overview, Alerts, Blind Spots, Model Lab, and Replay. In Alerts, known labels stay hidden until you reveal them after reviewing cases. Open an alert to inspect model contributions, record a browser-local decision, and compare a hypothetical scenario. The Overview can download a PDF report. The sample uses 2,000 evenly spaced chronological positions across all 36 final-test days and contains 20 fraud labels. Its default threshold yields 16 alerts.

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
To refresh only the bundled demonstration slice without re-evaluating the final test, run `.venv/bin/python -m ml.build_demo_sample` after preparing `data/processed/test.csv`.
The separate Blind Spots analysis is generated only from `data/processed/validation.csv` with `.venv/bin/python -m ml.build_error_analysis`; it never recomputes final-test metrics.

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

The root [render.yaml](render.yaml) defines one Docker web service on Render's free plan with `/api/health` as the health check. The public demo is linked above. Keep public uploads synthetic; this prototype has no accounts or multi-user case storage. Analyst review decisions stay in the browser under a versioned batch-and-model key and can be reset from Alerts.

The same container was tested locally with a 512 MB memory and 0.1 CPU limit. It started in about 15.5 seconds and scored a 20,000-row HTTP upload in 2.64 seconds with about 159 MiB peak cgroup memory. A 20,000-row synthetic upload to the public Render service returned HTTP 200 in 4.36 seconds. Host memory details and remaining checks are tracked in the [progress log](docs/internal/PROGRESS.md).

## Project documents

The original instructions are preserved in [PROJECT_BRIEF.md](PROJECT_BRIEF.md). The approved final brief is in [docs/internal/STAGE_A_REVIEW.md](docs/internal/STAGE_A_REVIEW.md), the numbered plan in [docs/internal/IMPLEMENTATION_GUIDE.md](docs/internal/IMPLEMENTATION_GUIDE.md), current status in [docs/internal/PROGRESS.md](docs/internal/PROGRESS.md), and a click-by-click presentation script in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).
