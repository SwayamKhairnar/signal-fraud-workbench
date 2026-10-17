# BankSim data

Source: [BankSim on Kaggle](https://www.kaggle.com/datasets/ealaxi/banksim1), from Edgar Alonso Lopez-Rojas and Stefan Axelsson's [BankSim paper](https://www.msc-les.org/proceedings/emss/2014/EMSS2014_144.pdf). Kaggle reports the dataset license as **CC BY-NC-SA 4.0**. The bundled derived development sample is attributed to the authors and shared under the same license for this noncommercial college project. Do not use the data for a commercial deployment without checking the license.

The original CSV is not committed to the repository. Download it with the Kaggle CLI:

```bash
kaggle datasets download -d ealaxi/banksim1 -f bs140513_032310.csv -p data/raw
unzip -o data/raw/bs140513_032310.csv.zip -d data/raw
```

The inspected source file is `bs140513_032310.csv` (48,986,035 bytes), SHA-256:

```text
e37006f76d993bfaec3a02d717b4f0bdc1ebfa5d36449e91fb7c07e225278377
```

To reproduce the inspection and chronological partitions:

```bash
.venv/bin/python ml/inspect_data.py --input data/raw/bs140513_032310.csv --output data/source_profile.json
.venv/bin/python ml/prepare_data.py --input data/raw/bs140513_032310.csv --output data/processed
```

The raw columns are `step,customer,age,gender,zipcodeOri,merchant,zipMerchant,category,amount,fraud`. The app's canonical schema is `transaction_id,step,merchant,category,amount` with optional `fraud` (`0`/`1`). The blank [template](template.csv) includes the optional label column for evaluation; users may remove it for unlabeled scoring. `transaction_id` is a display/review key, not a model feature. The `step` value is a **simulation day**, not a real date. Amounts are in the simulator's payment units; the UI must not relabel them as rupees or another real currency.

The data preparation script strips the single-quote wrappers from merchant and category codes, generates deterministic transaction IDs from source row positions, and partitions **whole steps** in chronological order. It preserves all rows and the original fraud prevalence. The small `sample_dev.csv` comes from the first 2,000 validation rows and is only for development. The bundled `sample_labeled.csv` takes 2,000 evenly spaced chronological positions across all 36 days of the final test period (20 fraud labels); no rows were selected by score or label. Full partitions stay ignored by Git.
