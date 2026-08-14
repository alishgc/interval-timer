/* ==========================================
   INTERVAL TIMER v2.1.0
   PART 1
========================================== */

const STORAGE_KEY = "intervalTimerV21";

/* ==========================================
   CONFIG
========================================== */

const defaults = {
    work: 40,
    rest: 20,
    rounds: 10,
    prep: 5,

    tickSound: true,
    skipLastRest: false,
    vibration: true,

    presets: []
};

let config = {};
let wakeLock = null;
let audioCtx = null;

/* ==========================================
   TIMER STATE
========================================== */

let timerInterval = null;

let state = {
    running: false,
    paused: false,

    phase: "prep",

    round: 1,

    secondsLeft: 0,

    lastWorkoutConfig: null
};

/* ==========================================
   STORAGE
========================================== */

function loadConfig() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

        config = {
            ...defaults,
            ...saved
        };

    } catch {

        config = { ...defaults };

    }

}

function saveConfig() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(config)
    );

}

/* ==========================================
   ELEMENT HELPERS
========================================== */

const $ = id =>
    document.getElementById(id);

/* ==========================================
   AUDIO
========================================== */

function ensureAudio() {

    if (audioCtx) return;

    try {

        audioCtx =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

    } catch (err) {

        console.warn(
            "Audio unavailable"
        );

    }

}

function playTone(
    frequency,
    duration = 120,
    volume = 0.2
) {

    if (!audioCtx) return;

    const osc =
        audioCtx.createOscillator();

    const gain =
        audioCtx.createGain();

    osc.frequency.value =
        frequency;

    osc.type = "sine";

    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(
        audioCtx.destination
    );

    osc.start();

    setTimeout(() => {

        osc.stop();

    }, duration);

}

function tickSound() {

    if (!config.tickSound) return;

    playTone(500, 40, 0.03);

}

function countdownBeep() {

    playTone(950, 140, 0.18);

}

function transitionSound() {

    playTone(900, 120, 0.15);

    setTimeout(() => {

        playTone(1200, 120, 0.15);

    }, 140);

}

function completeSound() {

    playTone(850, 150);

    setTimeout(() => {

        playTone(1000, 150);

    }, 180);

    setTimeout(() => {

        playTone(1300, 220);

    }, 360);

}

/* ==========================================
   VIBRATION
========================================== */

function vibrate(ms) {

    if (!config.vibration)
        return;

    if (
        navigator.vibrate
    ) {

        navigator.vibrate(ms);

    }

}

/* ==========================================
   WAKE LOCK
========================================== */

async function requestWakeLock() {

    try {

        if (
            "wakeLock" in navigator
        ) {

            wakeLock =
                await navigator
                    .wakeLock
                    .request("screen");

        }

    } catch (err) {

        console.warn(
            "Wake Lock unavailable"
        );

    }

}

async function releaseWakeLock() {

    if (!wakeLock)
        return;

    try {

        await wakeLock.release();

    } catch {}

    wakeLock = null;

}

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
                "visible" &&
            state.running &&
            !state.paused
        ) {

            requestWakeLock();

        }

    }
);

/* ==========================================
   SETTINGS
========================================== */

function openSettings() {

    $("setupScreen").style.display =
        "none";

    $("settingsScreen").style.display =
        "block";

}

function closeSettings() {

    saveSettings();

    $("settingsScreen").style.display =
        "none";

    $("setupScreen").style.display =
        "flex";

}

function adjustPrep(delta) {

    config.prep =
        Math.max(
            0,
            config.prep + delta
        );

    updateSettingsUI();

    saveConfig();

}

function updateSettingsUI() {

    $("prepValue").textContent =
        `${config.prep} sec`;

    $("tickSound").checked =
        config.tickSound;

    $("skipLastRest").checked =
        config.skipLastRest;

    $("vibrationEnabled").checked =
        config.vibration;

}

function saveSettings() {

    config.tickSound =
        $("tickSound").checked;

    config.skipLastRest =
        $("skipLastRest").checked;

    config.vibration =
        $("vibrationEnabled").checked;

    saveConfig();

}

/* ==========================================
   INPUT HELPERS
========================================== */

function clamp(
    value,
    min,
    max
) {

    return Math.min(
        max,
        Math.max(
            min,
            value
        )
    );

}

function getNumber(id) {

    return parseInt(
        $(id).value,
        10
    ) || 0;

}

function adjustValue(
    type,
    amount
) {

    let input;

    if (type === "work")
        input = $("workInput");

    if (type === "rest")
        input = $("restInput");

    if (type === "rounds")
        input = $("roundsInput");

    let value =
        parseInt(input.value, 10) || 0;

    value += amount;

    if (type === "rounds") {

        value =
            clamp(
                value,
                1,
                999
            );

    } else {

        value =
            clamp(
                value,
                1,
                3600
            );

    }

    input.value = value;

    updateTotalTime();

}

/* ==========================================
   PRESETS
========================================== */

function openPresetModal() {

    $("presetModal").style.display =
        "flex";

    $("presetName").value = "";

    $("presetWork").value =
        $("workInput").value;

    $("presetRest").value =
        $("restInput").value;

    $("presetPrep").value =
        config.prep;

    $("presetRounds").value =
        $("roundsInput").value;

}

function closePresetModal() {

    $("presetModal").style.display =
        "none";

}

function savePreset() {

    const name =
        $("presetName")
            .value
            .trim();

    if (!name) {

        alert(
            "Enter a preset name"
        );

        return;

    }

    const preset = {

        id:
            Date.now()
            .toString(),

        name,

        work:
            getNumber(
                "presetWork"
            ),

        rest:
            getNumber(
                "presetRest"
            ),

        prep:
            getNumber(
                "presetPrep"
            ),

        rounds:
            getNumber(
                "presetRounds"
            )

    };

    config.presets.push(
        preset
    );

    saveConfig();

    renderPresets();

    closePresetModal();

}

function deletePreset(id) {

    const preset =
        config.presets.find(
            p => p.id === id
        );

    if (!preset)
        return;

    const confirmed =
        confirm(
            `Delete "${preset.name}"?`
        );

    if (!confirmed)
        return;

    config.presets =
        config.presets.filter(
            p => p.id !== id
        );

    saveConfig();

    renderPresets();

}

function loadPreset(id) {

    const preset =
        config.presets.find(
            p => p.id === id
        );

    if (!preset)
        return;

    $("workInput").value =
        preset.work;

    $("restInput").value =
        preset.rest;

    $("roundsInput").value =
        preset.rounds;

    config.prep =
        preset.prep;

    updateSettingsUI();

    updateTotalTime();

    saveConfig();

}

function renderPresets() {

    const container =
        $("presetList");

    container.innerHTML = "";

    config.presets.forEach(
        preset => {

            const chip =
                document.createElement(
                    "div"
                );

            chip.className =
                "preset-chip";

            chip.innerHTML = `
                <button
                    class="preset-load"
                    onclick="loadPreset('${preset.id}')">
                    ${preset.name}
                </button>

                <button
                    class="preset-delete"
                    onclick="deletePreset('${preset.id}')">
                    ✕
                </button>
            `;

            container.appendChild(
                chip
            );

        }
    );

}

/* ==========================================
   TOTAL WORKOUT TIME
========================================== */

function updateTotalTime() {

    const work =
        getNumber(
            "workInput"
        );

    const rest =
        getNumber(
            "restInput"
        );

    const rounds =
        getNumber(
            "roundsInput"
        );

    let total =
        config.prep;

    total +=
        work * rounds;

    if (
        config.skipLastRest
    ) {

        total +=
            rest *
            Math.max(
                0,
                rounds - 1
            );

    } else {

        total +=
            rest * rounds;

    }

    const mins =
        Math.floor(
            total / 60
        );

    const secs =
        total % 60;

    $("totalTimeText")
        .textContent =
        `${mins}m ${secs}s`;

}

/* ==========================================
   LOAD UI
========================================== */

function loadUIFromConfig() {

    $("workInput").value =
        config.work;

    $("restInput").value =
        config.rest;

    $("roundsInput").value =
        config.rounds;

    updateSettingsUI();

    renderPresets();

    updateTotalTime();

}

/* ==========================================
   SAVE CURRENT INPUTS
========================================== */

function saveCurrentInputs() {

    config.work =
        clamp(
            getNumber(
                "workInput"
            ),
            1,
            3600
        );

    config.rest =
        clamp(
            getNumber(
                "restInput"
            ),
            1,
            3600
        );

    config.rounds =
        clamp(
            getNumber(
                "roundsInput"
            ),
            1,
            999
        );

    saveConfig();

}

/* ==========================================
   EVENTS
========================================== */

function registerEvents() {

    $("settingsBtn")
        .addEventListener(
            "click",
            openSettings
        );

    $("workInput")
        .addEventListener(
            "input",
            updateTotalTime
        );

    $("restInput")
        .addEventListener(
            "input",
            updateTotalTime
        );

    $("roundsInput")
        .addEventListener(
            "input",
            updateTotalTime
        );

    $("tickSound")
        .addEventListener(
            "change",
            saveSettings
        );

    $("skipLastRest")
        .addEventListener(
            "change",
            () => {

                saveSettings();

                updateTotalTime();

            }
        );

    $("vibrationEnabled")
        .addEventListener(
            "change",
            saveSettings
        );

}

/* ==========================================
   BOOT
========================================== */

loadConfig();

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadUIFromConfig();

        registerEvents();

    }
);

/* ==========================================
   TIMER ENGINE
   PART 3
========================================== */

function startSession() {

    ensureAudio();

    saveCurrentInputs();

    state.lastWorkoutConfig = {
        work: config.work,
        rest: config.rest,
        rounds: config.rounds,
        prep: config.prep
    };

    state.running = true;
    state.paused = false;

    state.round = 1;

    if (config.prep > 0) {

        state.phase = "prep";
        state.secondsLeft = config.prep;

    } else {

        state.phase = "work";
        state.secondsLeft = config.work;

    }

    $("setupScreen").style.display =
        "none";

    $("completeScreen").style.display =
        "none";

    $("timerScreen").style.display =
        "flex";

    $("pauseBtn").textContent =
        "⏸ Pause";

    updatePhaseVisual();

    updateProgress();

    renderTimer();

    requestWakeLock();

    clearInterval(
        timerInterval
    );

    timerInterval =
        setInterval(
            tick,
            1000
        );

}

function tick() {

    if (
        !state.running ||
        state.paused
    ) {
        return;
    }

    tickSound();

    if (
        state.secondsLeft <= 3 &&
        state.secondsLeft > 0
    ) {

        countdownBeep();

    }

    state.secondsLeft--;

    if (
        state.secondsLeft < 0
    ) {

        nextPhase();

        return;

    }

    renderTimer();

}

function nextPhase() {

    transitionSound();

    vibrate(200);

    /* PREP -> WORK */

    if (
        state.phase === "prep"
    ) {

        state.phase = "work";

        state.secondsLeft =
            config.work;

        updatePhaseVisual();

        renderTimer();

        return;

    }

    /* WORK -> REST */

    if (
        state.phase === "work"
    ) {

        const isLastRound =
            state.round ===
            config.rounds;

        if (
            isLastRound &&
            config.skipLastRest
        ) {

            finishWorkout();

            return;

        }

        state.phase = "rest";

        state.secondsLeft =
            config.rest;

        updatePhaseVisual();

        renderTimer();

        return;

    }

    /* REST -> NEXT WORK */

    if (
        state.phase === "rest"
    ) {

        if (
            state.round >=
            config.rounds
        ) {

            finishWorkout();

            return;

        }

        state.round++;

        state.phase = "work";

        state.secondsLeft =
            config.work;

        updateProgress();

        updatePhaseVisual();

        renderTimer();

    }

}

function renderTimer() {

    $("timeDisplay")
        .textContent =
        state.secondsLeft;

    let phaseText =
        "WORK";

    if (
        state.phase === "prep"
    ) {

        phaseText =
            "PREP";

    }

    if (
        state.phase === "rest"
    ) {

        phaseText =
            "REST";

    }

    $("phaseLabel")
        .textContent =
        phaseText;

    $("roundLabel")
        .textContent =
        `ROUND ${state.round} / ${config.rounds}`;

}

/* ==========================================
   PHASE COLORS
========================================== */

function updatePhaseVisual() {

    document.body.classList.remove(
        "phase-prep",
        "phase-work",
        "phase-rest",
        "phase-complete"
    );

    if (
        state.phase === "prep"
    ) {

        document.body.classList.add(
            "phase-prep"
        );

    }

    if (
        state.phase === "work"
    ) {

        document.body.classList.add(
            "phase-work"
        );

    }

    if (
        state.phase === "rest"
    ) {

        document.body.classList.add(
            "phase-rest"
        );

    }

}

/* ==========================================
   PROGRESS BAR
========================================== */

function updateProgress() {

    const percent =
        (
            (
                state.round - 1
            ) /
            config.rounds
        ) * 100;

    $("progressBar").style.width =
        `${percent}%`;

}

/* ==========================================
   COMPLETE
========================================== */

function finishWorkout() {

    clearInterval(
        timerInterval
    );

    timerInterval = null;

    state.running = false;

    releaseWakeLock();

    completeSound();

    vibrate(500);

    $("timerScreen").style.display =
        "none";

    $("completeScreen").style.display =
        "flex";

    document.body.classList.remove(
        "phase-prep",
        "phase-work",
        "phase-rest"
    );

    document.body.classList.add(
        "phase-complete"
    );

    const totalWork =
        config.work *
        config.rounds;

    const mins =
        Math.floor(
            totalWork / 60
        );

    const secs =
        totalWork % 60;

    $("completeSummary")
        .innerHTML = `
        <p>
            Rounds:
            <strong>${config.rounds}</strong>
        </p>

        <p>
            Work Time:
            <strong>${mins}m ${secs}s</strong>
        </p>
    `;

    $("progressBar").style.width =
        "100%";

}

/* ==========================================
   PAUSE
========================================== */

function togglePause() {

    if (
        !state.running
    ) return;

    state.paused =
        !state.paused;

    $("pauseBtn")
        .textContent =
        state.paused
            ? "▶ Resume"
            : "⏸ Pause";

    if (
        state.paused
    ) {

        releaseWakeLock();

    } else {

        requestWakeLock();

    }

}

/* ==========================================
   RESET
========================================== */

function resetSession() {

    clearInterval(
        timerInterval
    );

    timerInterval = null;

    state.running = false;
    state.paused = false;

    releaseWakeLock();

    document.body.classList.remove(
        "phase-prep",
        "phase-work",
        "phase-rest",
        "phase-complete"
    );

    $("timerScreen").style.display =
        "none";

    $("completeScreen").style.display =
        "none";

    $("settingsScreen").style.display =
        "none";

    $("presetModal").style.display =
        "none";

    $("setupScreen").style.display =
        "flex";

    updateTotalTime();

}

/* ==========================================
   REPEAT WORKOUT
========================================== */

function repeatWorkout() {

    if (
        !state.lastWorkoutConfig
    ) {

        resetSession();

        return;

    }

    config.work =
        state.lastWorkoutConfig.work;

    config.rest =
        state.lastWorkoutConfig.rest;

    config.rounds =
        state.lastWorkoutConfig.rounds;

    config.prep =
        state.lastWorkoutConfig.prep;

    saveConfig();

    startSession();

}

/* ==========================================
   EXIT PROTECTION
========================================== */

window.addEventListener(
    "beforeunload",
    event => {

        if (
            !state.running
        ) {
            return;
        }

        event.preventDefault();

        event.returnValue = "";

    }
);

/* ==========================================
   FINAL INIT
========================================== */

updateTotalTime();

renderPresets();

updateSettingsUI();