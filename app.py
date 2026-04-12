"""
Flask backend — prediction API + Google Sheets submission + minimal auth.
"""

import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

# ─── Limit threads BEFORE importing numpy/sklearn/xgboost ───────────
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("XGB_NTHREAD", "1")

# Ensure the project directory is on sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.chdir(BASE_DIR)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("flaprisk")

import joblib
import pandas as pd
from flask import Flask, jsonify, request, render_template, session, redirect, url_for

import config
import sheets_client

app = Flask(__name__,
            template_folder=str(BASE_DIR / "templates"),
            static_folder=str(BASE_DIR / "static"))
app.secret_key = config.ACCESS_KEY + "_session_secret"

# ─── Load model and metadata at startup ──────────────────────────────
logger.info("Loading XGBoost model...")
model = joblib.load(str(BASE_DIR / "model" / "xgb_pipeline.joblib"))
with open(BASE_DIR / "model" / "model_metadata.json") as f:
    model_metadata = json.load(f)
logger.info("Model loaded — version %s", model_metadata.get("model_version"))

# ─── Diagnostic: Sheets env vars ────────────────────────────────────
_creds_raw = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")
logger.info("GOOGLE_SHEETS_ID present: %s", bool(os.environ.get("GOOGLE_SHEETS_ID")))
logger.info("GOOGLE_CREDENTIALS_JSON present: %s, len: %d", bool(_creds_raw), len(_creds_raw))


# ─── Auth helpers ────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        key = request.form.get("access_key", "")
        if key == config.ACCESS_KEY:
            session["authenticated"] = True
            return redirect(url_for("index"))
        error = "Clave incorrecta"
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ─── Main page ───────────────────────────────────────────────────────
@app.route("/")
@login_required
def index():
    return render_template("index.html", config={
        "centros": config.CENTROS,
        "tipo_colgajo": config.TIPO_COLGAJO_MAP,
        "sexo": config.SEXO_MAP,
        "asa_options": config.ASA_OPTIONS,
        "componentes": config.COMPONENTES_COLGAJO,
        "indicaciones": config.INDICACIONES,
        "sitios": config.SITIOS_RECEPTOR,
        "tabaquismo": config.TABAQUISMO_OPTIONS,
        "colgajo_componentes": config.COLGAJO_COMPONENTES,
        "umbrales_colgajo": config.UMBRALES_COLGAJO,
        "tasa_local": config.TASA_LOCAL,
        "tasa_global": config.TASA_GLOBAL,
        "model_version": config.MODEL_VERSION,
        "form_version": config.FORM_VERSION,
        "sheets_configured": sheets_client.is_configured(),
    })


# ─── Prediction API ─────────────────────────────────────────────────
@app.route("/api/predict", methods=["POST"])
@login_required
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        patient = {}
        for var in config.MODEL_PREDICTORS:
            val = data.get(var)
            if val is None or val == "":
                return jsonify({"error": f"Missing variable: {var}"}), 400
            patient[var] = str(val)

        logger.info("Predict request received — building DataFrame")
        df = pd.DataFrame([patient])
        prob = float(model.predict_proba(df)[:, 1][0])
        logger.info("Predict done — prob=%.4f", prob)

        if prob < 0.10:
            level = "bajo"
        elif prob < 0.25:
            level = "moderado"
        else:
            level = "alto"

        return jsonify({
            "risk_probability": round(prob, 4),
            "risk_percentage": round(prob * 100, 1),
            "risk_level": level,
            "model_version": config.MODEL_VERSION,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Submit to Google Sheets ─────────────────────────────────────────
@app.route("/api/submit", methods=["POST"])
@login_required
def submit():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    record_uuid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    observations = []
    edad = data.get("edad")
    if edad and (int(edad) < 18 or int(edad) > 100):
        observations.append(f"Edad fuera de rango habitual: {edad}")

    row = [
        record_uuid,
        now,
        config.MODEL_VERSION,
        config.FORM_VERSION,
        data.get("registrador", ""),
        data.get("centro", ""),
        data.get("id_paciente", ""),
        data.get("sexo", ""),
        data.get("edad", ""),
        data.get("tipodecolgajolibre", ""),
        data.get("obesidad", ""),
        data.get("bajopeso", ""),
        data.get("asa", ""),
        data.get("hipertension", ""),
        data.get("diabetes", ""),
        data.get("evp", ""),
        data.get("antecedente_onco", ""),
        data.get("radioterapia", ""),
        data.get("quimioterapia", ""),
        data.get("transfusion_preop", ""),
        data.get("antecedentedetrauma", ""),
        data.get("infeccion_previa", ""),
        data.get("cirugia_previa", ""),
        data.get("componentesdelcolgajo", ""),
        data.get("indicacion", ""),
        data.get("anemia", ""),
        data.get("sitioreceptor", ""),
        data.get("tabaquismo", ""),
        data.get("otro_colgajo_cual", ""),
        data.get("riesgo_predicho", ""),
        "completo",
        "; ".join(observations) if observations else "",
    ]

    saved = sheets_client.append_record(row)
    return jsonify({
        "saved": saved,
        "uuid": record_uuid,
        "message": "Registro guardado" if saved else "Google Sheets no configurado — registro no guardado",
    })


# ─── Config endpoint (for frontend) ─────────────────────────────────
@app.route("/api/config")
@login_required
def get_config():
    return jsonify({
        "centros": config.CENTROS,
        "tipo_colgajo": {str(k): v for k, v in config.TIPO_COLGAJO_MAP.items()},
        "sexo": {str(k): v for k, v in config.SEXO_MAP.items()},
        "asa_options": config.ASA_OPTIONS,
        "componentes": config.COMPONENTES_COLGAJO,
        "indicaciones": config.INDICACIONES,
        "sitios": config.SITIOS_RECEPTOR,
        "tabaquismo": config.TABAQUISMO_OPTIONS,
        "colgajo_componentes": config.COLGAJO_COMPONENTES,
        "umbrales_colgajo": config.UMBRALES_COLGAJO,
        "tasa_local": config.TASA_LOCAL,
        "tasa_global": config.TASA_GLOBAL,
        "model_version": config.MODEL_VERSION,
        "form_version": config.FORM_VERSION,
        "sheets_configured": sheets_client.is_configured(),
        "debug_sheets_id_present": bool(os.environ.get("GOOGLE_SHEETS_ID")),
        "debug_creds_present": bool(os.environ.get("GOOGLE_CREDENTIALS_JSON")),
    })


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, port=port)
