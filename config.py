import os

# ─── Versiones (auditoria) ───────────────────────────────────────────
MODEL_VERSION = "xgb_v1.0"
FORM_VERSION = "form_v1.0"

# ─── Control de acceso ───────────────────────────────────────────────
ACCESS_KEY = os.environ.get("ACCESS_KEY", "colgajo2026")

# ─── Google Sheets ───────────────────────────────────────────────────
GOOGLE_SHEETS_ID = os.environ.get("GOOGLE_SHEETS_ID", "")
GOOGLE_CREDENTIALS_JSON = os.environ.get("GOOGLE_CREDENTIALS_JSON", "")

# ─── Mapeo tipo de colgajo libre (EDITABLE) ──────────────────────────
TIPO_COLGAJO_MAP = {
    0: "Radial forearm",
    1: "ALT",
    2: "DIEP",
    3: "Fibula",
    4: "Otros",
}

# ─── Centros participantes ───────────────────────────────────────────
CENTROS = [
    "Clínica Colombia",
    "San José",
    "Nogales",
    "Méderi",
    "Samaritana",
]

# ─── Opciones de tabaquismo (solo captura, NO predicción) ────────────
TABAQUISMO_OPTIONS = [
    "Nunca",
    "Ex-fumador",
    "Activo",
    "No registrado",
]

# ─── Sexo ────────────────────────────────────────────────────────────
SEXO_MAP = {
    0: "Femenino",
    1: "Masculino",
}

# ─── ASA ─────────────────────────────────────────────────────────────
ASA_OPTIONS = [1, 2, 3, 4, 5]

# ─── Componentes del colgajo (valores normalizados del modelo) ───────
COMPONENTES_COLGAJO = [
    "DERMOGRASO",
    "FASCIOCUTANEO",
    "OSTEOCUTANEO",
    "MUSCULOCUTANEO",
    "MUSCULAR",
    "NERVIO",
    "VASCULAR",
    "REIMPLANTE",
    "OSEO",
]

# ─── Indicación quirúrgica ───────────────────────────────────────────
INDICACIONES = [
    "ONCOLÓGICO",
    "TRAUMA",
    "INFECCIÓN CONCOMITANTE",
    "CONGÉNITO",
    "SECUELA DE QUEMADURAS",
    "RECONSTRUCCIÓN PREVIA FALLIDA",
    "ÁREA CRUENTA SECUNDARIO A PROCEDIMIENTO",
    "FACIAL",
    "OSTEONECROSIS",
    "REASIGNACIÓN DE GÉNERO",
    "LINFEDEMA",
]

# ─── Sitio receptor ──────────────────────────────────────────────────
SITIOS_RECEPTOR = [
    "CABEZA Y CUELLO",
    "MAMA",
    "MIEMBRO INFERIOR",
    "MIEMBRO SUPERIOR",
    "TÓRAX",
    "PERINEAL",
    "DORSO",
    "REGIÓN GLÚTEA",
]

# ─── Variables binarias (Sí=1, No=0) ────────────────────────────────
BINARY_VARIABLES = [
    "obesidad",
    "bajopeso",
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
    "anemia",
]

# ─── Orden de las 19 variables del modelo ────────────────────────────
MODEL_PREDICTORS = [
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

# ─── Columnas Google Sheets (orden) ─────────────────────────────────
SHEETS_COLUMNS = [
    "uuid_registro",
    "fecha_hora",
    "version_modelo",
    "version_formulario",
    "registrador",
    "centro",
    "id_paciente",
    "sexo",
    "edad",
    "tipodecolgajolibre",
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
    "tabaquismo",
    "riesgo_predicho",
    "estado_registro",
    "observaciones_validacion",
]
