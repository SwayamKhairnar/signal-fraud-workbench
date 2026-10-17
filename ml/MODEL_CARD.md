# BankSim v1 model card

## Purpose

This model ranks **synthetic BankSim-format bank payments** for human review in a college demonstration. It does not establish that a payment is fraudulent, and its measured performance does not transfer automatically to real banks.

## Data and features

The [BankSim dataset](https://www.kaggle.com/datasets/ealaxi/banksim1) contains 594,643 simulated payments, 7,200 labeled frauds, and 180 simulation days. The source is attributed to Edgar Alonso Lopez-Rojas and Stefan Axelsson and licensed CC BY-NC-SA 4.0. The source file hash and exact split counts are in `artifacts/manifest.json`.

The model uses simulation day, log-transformed amount, merchant code, and purchase category. It excludes the fraud label, transaction ID, customer ID, age, gender, and ZIP codes. It uses no future transaction history or uploaded labels. The same train-fitted encoder and scaler are saved with the model.

## Split and selection

Whole simulation days were split chronologically: training 0–107, validation 108–143, final test 144–179. Logistic regression and LightGBM were fitted on training rows. Each candidate's threshold was chosen on validation to maximize F1 while flagging at most 5% of validation transactions. LightGBM was selected because its validation average precision improved by 0.0215 absolute and validation recall at its operating point was not lower than logistic regression. The final test was evaluated after this selection and was not used to change it.

## Final chronological test results

| Model | Average precision | Precision | Recall | F1 | Alert rate |
|---|---:|---:|---:|---:|---:|
| Logistic regression | 0.894 | 0.865 | 0.781 | 0.821 | 0.98% |
| **LightGBM (deployed)** | **0.913** | **0.900** | 0.765 | **0.827** | 0.92% |

There were 133,231 test payments and 1,440 fraud labels (1.08% prevalence). LightGBM gave the better test average precision, precision, and F1, while logistic regression caught a slightly larger fraction of fraud at its own validation-chosen threshold. These are results on synthetic simulator data only.

## Explainability and limits

LightGBM's built-in feature contributions decompose its raw score for each row. The app will translate the largest positive contributions into short explanations and show the feature values. Contributions describe model behavior, not causes of fraud. The score is displayed as a ranking signal, not a calibrated real-world fraud probability. The app scores only the documented schema and never retrains on uploads.

The simulator's patterns may be simpler than real fraud, and behavior can change across institutions or time. Merchant and category codes may not exist in a new bank. A human should inspect the transaction and other evidence before making any decision.
