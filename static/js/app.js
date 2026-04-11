/* ═══════════════════════════════════════════════════════════════════
   FlapRisk — Frontend Logic (modular, migration-ready)
   ═══════════════════════════════════════════════════════════════════ */

const TOTAL_STEPS = 8;
const RISK_RING_CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 in SVG

const STEP_LABELS = [
    "Registrador",
    "Paciente",
    "Comorbilidades",
    "Historia oncologica",
    "Historia quirurgica",
    "Cirugia planeada",
    "Tabaquismo",
    "Resultado",
];

const LEVEL_LABELS = {
    bajo: "Riesgo bajo",
    moderado: "Riesgo moderado",
    alto: "Riesgo alto",
};

let currentStep = 1;

/* ─── Init ────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    populateSelects();
    initToggles();
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
    fill("decenio", c.decenios.map(v => [v, v]));
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

    if (currentStep === 7) {
        goToStep(8);
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
    } else if (currentStep === 7) {
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
        renderResult(result);
        show("resultArea");

        // Auto-save
        data.riesgo_predicho = result.risk_percentage;
        saveToSheets(data);

    } catch (err) {
        hide("loadingArea");
        showSaveStatus("Error de conexion: " + err.message, false);
    }
}

function renderResult(result) {
    const pct = result.risk_percentage;
    const level = result.risk_level;

    // Value
    const valueEl = document.getElementById("riskValue");
    valueEl.textContent = pct + "%";
    valueEl.className = "risk-value " + level;

    // SVG ring animation
    const ringFill = document.getElementById("riskRingFill");
    const fraction = Math.min(pct / 100, 1);
    const offset = RISK_RING_CIRCUMFERENCE * (1 - fraction);
    ringFill.className.baseVal = "risk-ring-fill " + level;
    // Force reflow to restart animation
    ringFill.style.strokeDashoffset = RISK_RING_CIRCUMFERENCE;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ringFill.style.strokeDashoffset = offset;
        });
    });

    // Badge
    const badge = document.getElementById("riskLevelBadge");
    badge.className = "risk-level-badge " + level;
    document.getElementById("riskLevelText").textContent = LEVEL_LABELS[level] || level;

    // Model info
    document.getElementById("riskModelInfo").textContent =
        "Modelo " + result.model_version + " · AUC test 0.877";
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
    document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("selected"));
    document.querySelectorAll(".invalid").forEach(e => e.classList.remove("invalid"));
    document.querySelectorAll(".field-error").forEach(e => e.remove());
    hide("resultArea");
    hide("loadingArea");
    hide("saveStatus");

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
