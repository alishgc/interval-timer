// script.js
let config = { work: 40, rest: 20, rounds: 10 };
let state = { phase: 'work', secondsLeft: 40, round: 1, running: false, paused: false };
let tickInterval = null;
let wakeLock = null;
let audioCtx = null;

// ---------- Configuration ----------
function adjust(key, delta) {
    const min = key === 'rounds' ? 1 : 1;
    config[key] = Math.max(min, config[key] + delta);
    document.getElementById(key + 'Val').value = config[key];
    saveConfig();
}

function commit(key, inputEl) {
    let v = parseInt(inputEl.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    config[key] = v;
    inputEl.value = v;
    saveConfig();
}

function saveConfig() {
    try {
        localStorage.setItem('intervalTimerConfig', JSON.stringify(config));
    } catch (e) {}
}

function loadConfig() {
    try {
        const saved = localStorage.getItem('intervalTimerConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.work) config.work = parsed.work;
            if (parsed.rest) config.rest = parsed.rest;
            if (parsed.rounds) config.rounds = parsed.rounds;
        }
    } catch (e) {}
    document.getElementById('workVal').value = config.work;
    document.getElementById('restVal').value = config.rest;
    document.getElementById('roundsVal').value = config.rounds;
}
loadConfig();

// ---------- Audio ----------
function ensureAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function beep(freq, durationMs) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
        console.warn('Beep failed:', e);
    }
}

function vibrate(ms) {
    try {
        if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
}

// ---------- Wake Lock ----------
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });
        }
    } catch (e) {
        console.warn('Wake Lock not available:', e);
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        try {
            wakeLock.release();
        } catch (e) {}
        wakeLock = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.running && !state.paused) {
        requestWakeLock();
    }
});

// ---------- UI ----------
function setPhaseVisual(phase) {
    const run = document.getElementById('run');
    run.classList.remove('phase-work', 'phase-rest', 'phase-done');
    if (phase === 'work') run.classList.add('phase-work');
    else if (phase === 'rest') run.classList.add('phase-rest');
    else run.classList.add('phase-done');
}

function render() {
    const timeEl = document.getElementById('timeDisplay');
    const phaseEl = document.getElementById('phaseLabel');
    const roundEl = document.getElementById('roundLabel');

    if (state.phase === 'done') {
        phaseEl.textContent = '🎯 COMPLETE';
        timeEl.textContent = '✓';
        timeEl.classList.remove('pulse');
        roundEl.textContent = `${config.rounds} ROUNDS FINISHED`;
        document.getElementById('pauseBtn').style.display = 'none';
    } else {
        phaseEl.textContent = state.phase === 'work' ? 'WORK' : 'REST';
        timeEl.textContent = state.secondsLeft;
        if (state.secondsLeft <= 5) {
            timeEl.classList.add('pulse');
        } else {
            timeEl.classList.remove('pulse');
        }
        roundEl.textContent = `ROUND ${state.round} / ${config.rounds}`;
        document.getElementById('pauseBtn').style.display = '';
    }
    setPhaseVisual(state.phase);
}
//💪☕
// ---------- Timer Control ----------
function startSession() {
    ensureAudio();
    commit('work', document.getElementById('workVal'));
    commit('rest', document.getElementById('restVal'));
    commit('rounds', document.getElementById('roundsVal'));

    state = {
        phase: 'work',
        secondsLeft: config.work,
        round: 1,
        running: true,
        paused: false
    };

    document.getElementById('setup').style.display = 'none';
    document.getElementById('run').style.display = 'flex';
    document.getElementById('pauseBtn').textContent = '⏸ Pause';
    document.getElementById('pauseBtn').style.display = '';
    document.querySelector('#controls button:last-child').textContent = '⟳ Reset';

    requestWakeLock();
    render();
    tickInterval = setInterval(tick, 1000);
}

function tick() {
    if (!state.running || state.paused) return;

    if (state.secondsLeft <= 4 && state.secondsLeft > 1) {
        beep(880, 150);
    }

    state.secondsLeft--;

    if (state.secondsLeft <= 0) {
        vibrate(300);
        beep(1200, 400);

        if (state.phase === 'work') {
            state.phase = 'rest';
            state.secondsLeft = config.rest;
        } else {
            if (state.round >= config.rounds) {
                finishSession();
                return;
            }
            state.round++;
            state.phase = 'work';
            state.secondsLeft = config.work;
        }
    }
    render();
}

function finishSession() {
    state.running = false;
    state.phase = 'done';
    clearInterval(tickInterval);
    releaseWakeLock();
    document.querySelector('#controls button:last-child').textContent = '🔄 Start Over';
    beep(880, 200);
    setTimeout(() => beep(1100, 200), 300);
    render();
}

function togglePause() {
    state.paused = !state.paused;
    const btn = document.getElementById('pauseBtn');
    btn.textContent = state.paused ? '▶ Resume' : '⏸ Pause';
    btn.classList.toggle('active', state.paused);
    if (state.paused) {
        releaseWakeLock();
    } else {
        requestWakeLock();
    }
}

function resetSession() {
    clearInterval(tickInterval);
    releaseWakeLock();
    state.running = false;
    state.paused = false;
    document.getElementById('run').style.display = 'none';
    document.getElementById('setup').style.display = 'flex';
    document.getElementById('timeDisplay').classList.remove('pulse');
}