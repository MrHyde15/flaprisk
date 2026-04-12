/* ═══════════════════════════════════════════════════════════════════
   FlapRisk — Frontend Logic (modular, migration-ready)
   ═══════════════════════════════════════════════════════════════════ */

const TOTAL_STEPS = 7;
const RISK_RING_CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 in SVG

const STEP_LABELS = [
    "Registrador",
    "Paciente",
    "Comorbilidades",
    "Historia oncologica",
    "Historia quirurgica",
    "Cirugia planeada",
    "Resultado",
];

const NOMBRES_COLGAJO = {"0":"Radial forearm","1":"ALT","2":"DIEP","3":"Fibula","4":"Otros"};

let currentStep = 1;

/* ─── Init ────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    populateSelects();
    initToggles();
    initBusinessRules();
    updateUI();

    document.getElementById("btnNext").addEventListener("click", onNext);
    document.getElementById("btnPrev").addEventListener("click", onPrev);
});

/* ═══════════════════════════════════════════════════════════════════
   SELECTS — populate from config
   ═══════════════════════════════════════════════════════════════════ */
function populateSelects() {
    const c = APP_CONFIG;
    fill("centro", c.centros.map(v => [v, v]));
    fill("sexo", Object.entries(c.sexo));
    fill("asa", c.asa_options.map(v => [v, "ASA " + v]));
    fill("tipodecolgajolibre", Object.entries(c.tipo_colgajo));
    fill("componentesdelcolgajo", c.componentes.map(v => [v, titleCase(v)]));
    fill("indicacion", c.indicaciones.map(v => [v, titleCase(v)]));
    fill("sitioreceptor", c.sitios.map(v => [v, titleCase(v)]));
    fill("tabaquismo", c.tabaquismo.map(v => [v, v]));
}

function fill(id, pairs) {
    const el = document.getElementById(id);
    if (!el) return;
    pairs.forEach(([value, label]) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        el.appendChild(o);
    });
}

function titleCase(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ═══════════════════════════════════════════════════════════════════
   BUSINESS RULES
   ═══════════════════════════════════════════════════════════════════ */
function getToggleValue(name) {
    const group = document.querySelector(`.toggle-group[data-name="${name}"]`);
    if (!group) return null;
    const sel = group.querySelector(".toggle-btn.selected");
    return sel ? sel.dataset.value : null;
}

function initBusinessRules() {
    // 1. ASA restriction — diabetes, hta, evp toggles + tabaquismo select
    ["diabetes", "hipertension", "evp"].forEach(name => {
        document.querySelector(`.toggle-group[data-name="${name}"]`)
            ?.querySelectorAll(".toggle-btn")
            .forEach(btn => btn.addEventListener("click",
                () => setTimeout(updateASARestriction, 50)));
    });
    const tabSel = document.getElementById("tabaquismo");
    if (tabSel) tabSel.addEventListener("change", updateASARestriction);

    // 2. Oncology cascade — antecedente_onco controls radio/quimio
    document.querySelector('.toggle-group[data-name="antecedente_onco"]')
        ?.querySelectorAll(".toggle-btn")
        .forEach(btn => btn.addEventListener("click",
            () => setTimeout(applyOncologyCascade, 50)));

    // 3. Component filtering by flap type
    const tipoSel = document.getElementById("tipodecolgajolibre");
    if (tipoSel) tipoSel.addEventListener("change", filterComponents);
}

/* Rule 1 — ASA 1 blocked when comorbidities present */
function updateASARestriction() {
    const dm  = getToggleValue("diabetes");
    const hta = getToggleValue("hipertension");
    const evp = getToggleValue("evp");
    const tab = document.getElementById("tabaquismo")?.value || "";
    const tabPositive = (tab === "Activo" || tab === "Ex-fumador");

    const restricted = dm === "1" || hta === "1" || evp === "1" || tabPositive;

    const asaSel = document.getElementById("asa");
    const warn   = document.getElementById("asaWarning");
    if (!asaSel) return;

    const opt1 = asaSel.querySelector('option[value="1"]');
    if (restricted) {
        if (opt1) { opt1.disabled = true; opt1.textContent = "ASA 1 (no aplica)"; }
        if (asaSel.value === "1") {
            asaSel.value = "";
            if (warn) warn.classList.remove("hidden");
        }
    } else {
        if (opt1) { opt1.disabled = false; opt1.textContent = "ASA 1"; }
        if (warn) warn.classList.add("hidden");
    }
}

/* Rule 2 — Oncology cascade */
function applyOncologyCascade() {
    const onco = getToggleValue("antecedente_onco");
    ["radioterapia", "quimioterapia"].forEach(name => {
        const group = document.querySelector(`.toggle-group[data-name="${name}"]`);
        if (!group) return;
        group.querySelectorAll(".toggle-btn").forEach(btn => {
            if (onco === "0") {
                btn.classList.toggle("selected", btn.dataset.value === "0");
                btn.disabled = true;
                btn.style.opacity = "0.4";
                btn.style.pointerEvents = "none";
            } else {
                btn.disabled = false;
                btn.style.opacity = "";
                btn.style.pointerEvents = "";
            }
        });
    });
}

/* Rule 4 — Filter components by flap type + show otro_colgajo field */
function filterComponents() {
    const tipoSel  = document.getElementById("tipodecolgajolibre");
    const compSel  = document.getElementById("componentesdelcolgajo");
    const otroDiv  = document.getElementById("otroColgajoField");
    const otroIn   = document.getElementById("otro_colgajo_cual");
    if (!tipoSel || !compSel) return;

    const tipo    = tipoSel.value;
    const allowed = APP_CONFIG.colgajo_componentes[tipo];

    // Show/hide "otro colgajo" free-text
    if (otroDiv) otroDiv.classList.toggle("hidden", tipo !== "4");
    if (otroIn) {
        if (tipo === "4") otroIn.setAttribute("required", "");
        else { otroIn.removeAttribute("required"); otroIn.value = ""; }
    }

    if (!allowed) {
        Array.from(compSel.options).forEach(o => { o.hidden = false; o.disabled = false; });
        return;
    }

    const cur = compSel.value;
    Array.from(compSel.options).forEach(o => {
        if (!o.value) return;              // keep placeholder
        const ok = allowed.includes(o.value);
        o.hidden   = !ok;
        o.disabled = !ok;
    });
    if (cur && !allowed.includes(cur)) compSel.value = "";
    if (allowed.length === 1) compSel.value = allowed[0];
}

/* ═══════════════════════════════════════════════════════════════════
   TOGGLES — binary Yes/No buttons
   ═══════════════════════════════════════════════════════════════════ */
function initToggles() {
    document.querySelectorAll(".toggle-group").forEach(group => {
        group.querySelectorAll(".toggle-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                group.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                group.classList.remove("invalid");
            });
        });
    });
}

/* ═══════════════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════════════ */
function onNext() {
    if (currentStep === TOTAL_STEPS) {
        resetForm();
        return;
    }
    if (!validateStep(currentStep)) return;

    if (currentStep === 6) {
        goToStep(7);
        calculateRisk();
        return;
    }
    goToStep(currentStep + 1);
}

function onPrev() {
    if (currentStep > 1) goToStep(currentStep - 1);
}

function goToStep(next) {
    const outEl = document.querySelector(`.step[data-step="${currentStep}"]`);
    const inEl = document.querySelector(`.step[data-step="${next}"]`);
    if (!outEl || !inEl) return;

    // Animate out
    outEl.classList.add("exiting");
    outEl.addEventListener("animationend", function handler() {
        outEl.classList.remove("active", "exiting");
        outEl.removeEventListener("animationend", handler);
    }, { once: true });

    // Animate in after brief delay
    setTimeout(() => {
        inEl.classList.add("active");
        currentStep = next;
        updateUI();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, 180);
}

function updateUI() {
    // Progress
    const pct = (currentStep / TOTAL_STEPS) * 100;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("stepCounter").textContent = `${currentStep} / ${TOTAL_STEPS}`;
    document.getElementById("stepLabel").textContent = STEP_LABELS[currentStep - 1];

    // Buttons
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");

    btnPrev.classList.toggle("hidden", currentStep === 1);

    if (currentStep === TOTAL_STEPS) {
        btnNext.textContent = "Nueva evaluacion";
        btnNext.className = "btn-primary";
    } else if (currentStep === 6) {
        btnNext.textContent = "Calcular riesgo";
        btnNext.className = "btn-success";
    } else {
        btnNext.textContent = "Siguiente";
        btnNext.className = "btn-primary";
    }
}

/* ═══════════════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════════════ */
function validateStep(step) {
    const section = document.querySelector(`.step[data-step="${step}"]`);
    if (!section) return true;
    let valid = true;

    // Clear previous errors
    section.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
    section.querySelectorAll(".field-error").forEach(e => e.remove());

    // Inputs & selects
    section.querySelectorAll("input[required], select[required]").forEach(el => {
        if (!el.value.trim()) {
            markInvalid(el, "Campo requerido");
            valid = false;
        } else if (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) {
            markInvalid(el, "Correo no valido");
            valid = false;
        } else if (el.type === "number") {
            const v = parseInt(el.value);
            const mn = parseInt(el.min), mx = parseInt(el.max);
            if (isNaN(v) || v < mn || v > mx) {
                markInvalid(el, `Valor entre ${mn} y ${mx}`);
                valid = false;
            }
        }
    });

    // Toggle groups
    section.querySelectorAll(".toggle-group").forEach(group => {
        if (!group.querySelector(".toggle-btn.selected")) {
            group.classList.add("invalid");
            valid = false;
        }
    });

    // Rule 3 — Anemia/transfusion consistency (soft warning, step 5)
    if (step === 5) {
        const anemia = getToggleValue("anemia");
        const transfusion = getToggleValue("transfusion_preop");
        const warnDiv = document.getElementById("warningAnemiaTransfusion");
        const confirmCb = document.getElementById("confirmAnemiaTransfusion");
        if (anemia === "0" && transfusion === "1") {
            if (warnDiv) warnDiv.classList.remove("hidden");
            if (confirmCb && !confirmCb.checked) valid = false;
        } else {
            if (warnDiv) warnDiv.classList.add("hidden");
            if (confirmCb) confirmCb.checked = false;
        }
    }

    // Scroll to first error
    if (!valid) {
        const first = section.querySelector(".invalid");
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
}

function markInvalid(el, msg) {
    el.classList.add("invalid");
    const err = document.createElement("div");
    err.className = "field-error";
    err.textContent = msg;
    el.parentElement.appendChild(err);
}

/* ═══════════════════════════════════════════════════════════════════
   DATA COLLECTION
   ═══════════════════════════════════════════════════════════════════ */
function collectFormData() {
    const data = {};
    document.querySelectorAll("#wizardForm input, #wizardForm select").forEach(el => {
        if (el.name) data[el.name] = el.value;
    });
    document.querySelectorAll(".toggle-group").forEach(group => {
        const name = group.dataset.name;
        const sel = group.querySelector(".toggle-btn.selected");
        if (name && sel) data[name] = sel.dataset.value;
    });
    return data;
}

/* ═══════════════════════════════════════════════════════════════════
   RISK CALCULATION
   ═══════════════════════════════════════════════════════════════════ */
async function calculateRisk() {
    const data = collectFormData();

    show("loadingArea");
    hide("resultArea");
    hide("saveStatus");

    try {
        const res = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const result = await res.json();

        if (result.error) {
            hide("loadingArea");
            showSaveStatus("Error: " + result.error, false);
            return;
        }

        hide("loadingArea");
        renderResult(result, data.tipodecolgajolibre);
        show("resultArea");

        // Auto-save
        data.riesgo_predicho = result.risk_percentage;
        saveToSheets(data);

    } catch (err) {
        hide("loadingArea");
        showSaveStatus("Error de conexion: " + err.message, false);
    }
}

function renderResult(result, tipoColg) {
    const pct = result.risk_percentage;
    const cfg = APP_CONFIG;
    const tasaLocal  = cfg.tasa_local;   // 17.1
    const tasaGlobal = cfg.tasa_global;  //  5.1
    const umbral = cfg.umbrales_colgajo[tipoColg]; // number or undefined

    // ── Traffic-light logic ──
    let cssClass, labelText, refValue;

    if (umbral != null) {
        // Colgajo con umbral especifico (Radial, ALT, DIEP, Fibula)
        refValue = umbral;
        if (pct <= umbral) {
            cssClass = "bajo";
            labelText = "Riesgo inferior a la referencia reportada para este tipo de colgajo";
        } else if (pct <= tasaLocal) {
            cssClass = "moderado";
            labelText = "Riesgo superior a la referencia de este colgajo, pero inferior a la tasa local del estudio";
        } else {
            cssClass = "alto";
            labelText = "Riesgo superior a la tasa local observada en la cohorte retrospectiva";
        }
    } else {
        // Otros — referencia global
        refValue = tasaGlobal;
        if (pct <= tasaGlobal) {
            cssClass = "bajo";
            labelText = "Riesgo inferior a la referencia global reportada";
        } else if (pct <= tasaLocal) {
            cssClass = "moderado";
            labelText = "Riesgo superior a la referencia global, pero inferior a la tasa local del estudio";
        } else {
            cssClass = "alto";
            labelText = "Riesgo superior a la tasa local observada en la cohorte retrospectiva";
        }
    }

    // ── Value ──
    const valueEl = document.getElementById("riskValue");
    valueEl.textContent = pct + "%";
    valueEl.className = "risk-value " + cssClass;

    // ── SVG ring animation ──
    const ringFill = document.getElementById("riskRingFill");
    const fraction = Math.min(pct / 100, 1);
    const offset = RISK_RING_CIRCUMFERENCE * (1 - fraction);
    ringFill.className.baseVal = "risk-ring-fill " + cssClass;
    ringFill.style.strokeDashoffset = RISK_RING_CIRCUMFERENCE;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ringFill.style.strokeDashoffset = offset;
        });
    });

    // ── Badge — comparative text ──
    const badge = document.getElementById("riskLevelBadge");
    badge.className = "risk-level-badge " + cssClass;
    document.getElementById("riskLevelText").textContent = labelText;

    // ── Model info + reference thresholds ──
    const refLabel = umbral != null
        ? "Ref. " + NOMBRES_COLGAJO[tipoColg] + ": " + refValue + "%"
        : "Ref. global: " + refValue + "%";
    document.getElementById("riskModelInfo").textContent =
        "Modelo " + result.model_version + " · AUC 0.877 · " + refLabel + " · Local: " + tasaLocal + "%";
}

/* ═══════════════════════════════════════════════════════════════════
   GOOGLE SHEETS SAVE
   ═══════════════════════════════════════════════════════════════════ */
async function saveToSheets(data) {
    try {
        const res = await fetch("/api/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const result = await res.json();

        if (result.saved) {
            const statusEl = document.getElementById("saveStatus");
            statusEl.innerHTML =
                'Registro guardado exitosamente' +
                '<span class="save-uuid">ID: ' + result.uuid.slice(0, 8) + '...</span>';
            statusEl.className = "save-status success";
            statusEl.classList.remove("hidden");
        } else {
            showSaveStatus(result.message, false);
        }
    } catch (err) {
        showSaveStatus("No se pudo guardar: " + err.message, false);
    }
}

function showSaveStatus(msg, success) {
    const el = document.getElementById("saveStatus");
    el.textContent = msg;
    el.className = "save-status " + (success ? "success" : "error");
    el.classList.remove("hidden");
}

/* ═══════════════════════════════════════════════════════════════════
   RESET
   ═══════════════════════════════════════════════════════════════════ */
function resetForm() {
    document.getElementById("wizardForm").reset();
    document.querySelectorAll(".toggle-btn").forEach(b => {
        b.classList.remove("selected");
        b.disabled = false;
        b.style.opacity = "";
        b.style.pointerEvents = "";
    });
    document.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
    document.querySelectorAll(".field-error").forEach(e => e.remove());
    hide("resultArea");
    hide("loadingArea");
    hide("saveStatus");
    hide("warningAnemiaTransfusion");
    hide("asaWarning");
    const otroDiv = document.getElementById("otroColgajoField");
    if (otroDiv) otroDiv.classList.add("hidden");
    const otroIn = document.getElementById("otro_colgajo_cual");
    if (otroIn) { otroIn.removeAttribute("required"); otroIn.value = ""; }
    const asa1 = document.querySelector('#asa option[value="1"]');
    if (asa1) { asa1.disabled = false; asa1.textContent = "ASA 1"; }
    const confirmCb = document.getElementById("confirmAnemiaTransfusion");
    if (confirmCb) confirmCb.checked = false;

    // Reset ring
    const ring = document.getElementById("riskRingFill");
    ring.style.strokeDashoffset = RISK_RING_CIRCUMFERENCE;
    ring.className.baseVal = "risk-ring-fill";

    // Go to step 1 directly (no animation)
    document.querySelectorAll(".step").forEach(s => s.classList.remove("active", "exiting"));
    currentStep = 1;
    document.querySelector('.step[data-step="1"]').classList.add("active");
    updateUI();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ─── Helpers ─────────────────────────────────────────────────────── */
function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }
