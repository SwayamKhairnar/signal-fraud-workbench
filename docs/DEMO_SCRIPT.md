# Signal demo script (about 5 minutes)

## Before the presentation

1. Start the local API and frontend using `README.md`, or open the verified public link when available. On a free host, open it once before the presentation to allow a cold start.
2. Confirm the header says **Service connected**. Keep `data/sample_labeled.csv` as a fallback file. Do not use real customer data.
3. Use a laptop viewport or projector resolution. A fresh browser tab gives the cleanest path.

## Click-by-click walkthrough

1. **Explore sample batch.** Say: “This is a fixed chronological slice of synthetic BankSim transactions that the model never trained on. Training happened offline.” Wait for the overview.
2. **Overview.** Point to 2,000 valid rows, 14 default-threshold alerts, and 20 supplied fraud labels. Say: “The labels are present only in the demonstration file. On an unlabeled upload, the app hides measured fraud performance.” Mention the 1.00% labeled fraud share and the transaction, category, amount, and score charts.
3. **Alerts.** Open the highest-ranked alert. Point to its score, transaction fields, and signed contribution bars. Say: “The saved LightGBM model produced these factors. They explain changes in the model’s raw score, not causes of actual fraud.” Mark it **Needs review** and explain that this browser-local analyst decision is separate from the source fraud label.
4. **Threshold.** Move the threshold slightly up and down. Point to the changing alert count, precision, recall, F1, fraud caught, and false alarms. Say: “We are reclassifying the same saved scores, not retraining.” Reset to the saved threshold.
5. **What if.** In the open case, change the amount or category and choose **Score scenario**. Compare the original and hypothetical scores and factors. Say: “This is one hypothetical rescore through the same saved model. The original row is unchanged.”
6. **Model Lab.** Show the logistic baseline beside LightGBM. Explain that the fixed final test covers all 133,231 rows from simulation days 144-179, while the current batch section covers only these 2,000 rows. Point to average precision and the PR curve because fraud is rare; then explain TP, FP, FN, and TN using the confusion grid.
7. **Replay.** Start at 5x or 20x, pause, and resume. Say: “This plays already-scored transactions in simulation order. It is not live streaming.” At completion, the counters should show 2,000 processed and 14 alerts.
8. **Report.** Return to Overview and download the PDF. Open it and point to the dataset attribution, model version, threshold, and labeled batch metrics.

## Fallbacks and honest limitations

- If the public free service is asleep, allow its startup; use the local instance if presentation time is tight.
- If an upload is invalid, use the one-click sample or the downloadable template. The API reports missing columns and invalid rows.
- A one-class labeled batch has a confusion matrix and applicable threshold metrics, but ROC AUC and average precision are unavailable.
- Scores are rankings for synthetic transactions, not calibrated probabilities. This app has no real bank integration, accounts, or shared case database.
- Browser-local review decisions can be reset in Alerts; uploaded rows themselves are not retained after refresh.
