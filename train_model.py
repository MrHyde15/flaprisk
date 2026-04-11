"""
Train XGBoost model from BASE_FINAL.xlsx and export serialized pipeline.
Run once locally: python train_model.py
"""

import json
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# ─── 1. Load data ────────────────────────────────────────────────────
df = pd.read_excel("BASE_FINAL.xlsx", header=2)

# ─── 2. Rename columns to match script variable names ────────────────
column_map = {
    "TIPO DE COLGAJO LIBRE": "tipodecolgajolibre",
    "SEXO": "sexo",
    "OBESIDAD": "obesidad",
    "BAJO PESO": "bajopeso",
    "ASA": "asa",
}

# Handle columns with accents/spaces/newlines
for col in df.columns:
    stripped = col.strip()
    if "HIPERTENSI" in stripped:
        column_map[col] = "hipertension"
    elif "DIABETES" in stripped:
        column_map[col] = "diabetes"
    elif "EVP" in stripped:
        column_map[col] = "evp"
    elif "ANEMIA" in stripped:
        column_map[col] = "anemia"
    elif "COMPONENTES" in stripped:
        column_map[col] = "componentesdelcolgajo"
    elif "SITIO RECEPTOR" in stripped:
        column_map[col] = "sitioreceptor"
    elif "INDICACI" in stripped:
        column_map[col] = "indicacion"
    elif "ANTECEDENTE ONCOL" in stripped:
        column_map[col] = "antecedente_onco"
    elif "RADIOTERAPIA" in stripped:
        column_map[col] = "radioterapia"
    elif "QUIMIOTERAPIA" in stripped:
        column_map[col] = "quimioterapia"
    elif "TRANSFUSI" in stripped:
        column_map[col] = "transfusion_preop"
    elif "ANTECEDENTE DE TRAUMA" in stripped:
        column_map[col] = "antecedentedetrauma"
    elif "INFECCI" in stripped and "PREVIA" in stripped:
        column_map[col] = "infeccion_previa"
    elif "CIRUG" in stripped and "PREVIA" in stripped:
        column_map[col] = "cirugia_previa"
    elif "END POINT" in stripped or "ENDPOINT" in stripped:
        column_map[col] = "endpoint"

df = df.rename(columns=column_map)

# ─── 3. Normalize data quality issues ────────────────────────────────

# Fix obesity: 29.5 (BMI value) → NR
df.loc[~df["obesidad"].isin([0, 1, "NR", np.nan]), "obesidad"] = "NR"

# Normalize accent duplicates in componentesdelcolgajo
accent_fixes = {
    "FASCIOCUTÁNEO": "FASCIOCUTANEO",
    "MUSCULOCUTÁNEO": "MUSCULOCUTANEO",
}
df["componentesdelcolgajo"] = df["componentesdelcolgajo"].replace(accent_fixes)

# Normalize trailing spaces in sitioreceptor
df["sitioreceptor"] = df["sitioreceptor"].str.strip()

# Consolidate TÓRAX AP into TÓRAX
df["sitioreceptor"] = df["sitioreceptor"].replace({"TÓRAX AP": "TÓRAX"})

# ─── 4. Define outcome and predictors ────────────────────────────────
predictors = [
    "tipodecolgajolibre",
    "sexo",
    "obesidad",
    "bajopeso",
    "asa",
    "hipertension",
    "diabetes",
    "evp",
    "antecedente_onco",
    "radioterapia",
    "quimioterapia",
    "transfusion_preop",
    "antecedentedetrauma",
    "infeccion_previa",
    "cirugia_previa",
    "componentesdelcolgajo",
    "indicacion",
    "anemia",
    "sitioreceptor",
]

data = df[predictors + ["endpoint"]].copy()
data = data.dropna(subset=["endpoint"])

X = data[predictors].astype(str)
y = data["endpoint"].astype(int)

print(f"Dataset: {len(X)} patients, {y.sum()} events ({y.mean():.1%})")

# ─── 5. Preprocessing pipeline ───────────────────────────────────────
preprocess = ColumnTransformer(
    transformers=[
        (
            "cat",
            Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]
            ),
            predictors,
        )
    ],
    remainder="drop",
)

# ─── 6. Train/test split ─────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.30, stratify=y, random_state=2026
)

print(f"Train: {len(X_train)} | Test: {len(X_test)}")

# ─── 7. XGBoost model ────────────────────────────────────────────────
model = Pipeline(
    steps=[
        ("preprocess", preprocess),
        (
            "model",
            XGBClassifier(
                n_estimators=150,
                max_depth=3,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8,
                eval_metric="logloss",
                random_state=2026,
            ),
        ),
    ]
)

model.fit(X_train, y_train)

# ─── 8. Evaluate ─────────────────────────────────────────────────────
probs_train = model.predict_proba(X_train)[:, 1]
probs_test = model.predict_proba(X_test)[:, 1]

auc_train = roc_auc_score(y_train, probs_train)
auc_test = roc_auc_score(y_test, probs_test)
brier_train = brier_score_loss(y_train, probs_train)
brier_test = brier_score_loss(y_test, probs_test)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=2026)
cv_auc = cross_val_score(model, X_train, y_train, cv=cv, scoring="roc_auc")

print(f"\n{'='*40}")
print(f"Train AUC:  {auc_train:.3f}")
print(f"Test AUC:   {auc_test:.3f}")
print(f"Train Brier: {brier_train:.3f}")
print(f"Test Brier:  {brier_test:.3f}")
print(f"CV AUC (5-fold): {cv_auc.mean():.3f} ± {cv_auc.std():.3f}")
print(f"{'='*40}")

# ─── 9. Collect valid categories per variable ────────────────────────
categories = {}
for col in predictors:
    vals = X[col].dropna().unique().tolist()
    vals = [v for v in vals if v != "NR"]
    try:
        vals = sorted(vals)
    except TypeError:
        vals = sorted(vals, key=str)
    categories[col] = vals

# ─── 10. Export model and metadata ───────────────────────────────────
joblib.dump(model, "model/xgb_pipeline.joblib")

metadata = {
    "model_version": "xgb_v1.0",
    "trained_at": datetime.now(timezone.utc).isoformat(),
    "n_patients": len(X),
    "n_events": int(y.sum()),
    "event_rate": round(float(y.mean()), 4),
    "auc_train": round(auc_train, 4),
    "auc_test": round(auc_test, 4),
    "brier_train": round(brier_train, 4),
    "brier_test": round(brier_test, 4),
    "cv_auc_mean": round(float(cv_auc.mean()), 4),
    "cv_auc_std": round(float(cv_auc.std()), 4),
    "predictors": predictors,
    "categories": {k: [str(v) for v in vs] for k, vs in categories.items()},
}

with open("model/model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2, ensure_ascii=False)

print("\nModel saved to model/xgb_pipeline.joblib")
print("Metadata saved to model/model_metadata.json")
