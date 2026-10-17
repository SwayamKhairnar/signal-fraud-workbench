# Signal demo script (about 5 minutes)

## Before the presentation

1. Open the [public demo](https://signal-fraud-workbench.onrender.com/) before the presentation to allow the free host to wake. The local API and frontend in `README.md` are a fallback.
2. Confirm the header says **Service connected**. Keep `data/sample_labeled.csv` as a fallback file. Do not use real customer data.
3. Use a laptop viewport or projector resolution. A fresh browser tab gives the cleanest path.

## Click-by-click walkthrough

1. **Explore sample batch.** Follow the optional demo guide. Say: “This is a deterministic sample spread across all 36 held-out BankSim test days. The model never trained on these transactions; training happened offline.” Wait for the overview.
2. **Overview.** Point to 2,000 valid rows, 16 default-threshold alerts, and 20 supplied fraud labels. Say: “The labels are present only in the demonstration file. On an unlabeled upload, the app hides measured fraud performance.” Mention the 1.00% labeled fraud share and the transaction, category, amount, and score charts.
3. **Alerts.** Open the highest-ranked alert while known outcomes are hidden. Point to its score, transaction fields, and signed contribution bars. Say: “The saved LightGBM model produced these factors. They explain changes in the model’s raw score, not causes of actual fraud.” Record a decision, then reveal known outcomes to compare it with the source label.
4. **Threshold.** Move the threshold slightly up and down. Point to the changing alert count, precision, recall, F1, fraud caught, and false alarms. Say: “We are reclassifying the same saved scores, not retraining.” Reset to the saved threshold.
5. **What if.** In the open case, change the amount or category and choose **Score scenario**. Compare original and hypothetical scores and the change in each model contribution. Say: “This is one hypothetical rescore through the same saved model. The original row is unchanged.”
6. **Blind Spots.** Show validation-period recall by amount band and the workload curve. Say: “In validation, the model caught 25 of 120 frauds in the four lower amount bands. This is why aggregate F1 alone is not enough.” Note that the figures are synthetic and not a real-bank forecast.
7. **Model Lab.** Show the logistic baseline beside LightGBM. Explain that the fixed final test covers all 133,231 rows from simulation days 144-179, while the current batch section covers only these 2,000 rows. Point to average precision and the PR curve because fraud is rare; then explain TP, FP, FN, and TN using the confusion grid.
8. **Replay.** Start at 5x or 20x, pause, and resume. Say: “This plays already-scored transactions across 36 simulation days. It is not live streaming.” At completion, the counters should show 2,000 processed and 16 alerts.
9. **Report.** Return to Overview and download the PDF. Open it and point to the dataset attribution, model version, threshold, and labeled batch metrics.

## Fallbacks and honest limitations

- If the public free service is asleep, allow its startup; use the local instance if presentation time is tight.
- If an upload is invalid, use the one-click sample or the downloadable template. The API reports missing columns and invalid rows.
- A one-class labeled batch has a confusion matrix and applicable threshold metrics, but ROC AUC and average precision are unavailable.
- Scores are rankings for synthetic transactions, not calibrated probabilities. This app has no real bank integration, accounts, or shared case database.
- Browser-local review decisions can be reset in Alerts; uploaded rows themselves are not retained after refresh.
