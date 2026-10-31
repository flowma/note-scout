const LANG_STORAGE_KEY = 'noteScout.lang';
const FALLBACK_LANG = 'en';
const FLAGS = { en: '🇬🇧', de: '🇩🇪' };
const I18N = window.I18N || {};
let currentLang = detectLanguage();

function detectLanguage() {
    let stored = null;
    try { stored = window.localStorage.getItem(LANG_STORAGE_KEY); } catch (err) {}
    if (stored === 'en' || stored === 'de') return stored;
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.indexOf('de') === 0 ? 'de' : FALLBACK_LANG;
}

function t(key, params) {
    const dict = I18N[currentLang] || {};
    const fallbackDict = I18N[FALLBACK_LANG] || {};
    let template = dict[key];
    if (template === undefined) template = fallbackDict[key];
    if (template === undefined) return key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

function applyTranslations() {
    if (!I18N.en) return;
    document.documentElement.lang = currentLang;
    document.title = t('appTitle');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.textContent = FLAGS[currentLang] || FLAGS[FALLBACK_LANG];
        langToggle.setAttribute('aria-label', t('langSwitch'));
        langToggle.setAttribute('title', t('langSwitch'));
    }
}

function setLanguage(lang) {
    currentLang = (lang === 'de') ? 'de' : FALLBACK_LANG;
    try { window.localStorage.setItem(LANG_STORAGE_KEY, currentLang); } catch (err) {}
    applyTranslations();
}

document.getElementById('langToggle').addEventListener('click', () => {
    setLanguage(currentLang === 'de' ? 'en' : 'de');
});

applyTranslations();

const LOCAL_STORAGE_KEY = 'noteScout.melodies.v1';
const LEGACY_STORAGE_KEYS = ['vocalPitchCoach.melodies.v1'];
const RECORDING_LEAD_IN_SECONDS = 1;
const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const CLEFS = {
    treble8vb: {
        label: "Treble 8vb",
        glyph: "\uD834\uDD1E",
        referenceDiatonic: 27,
        showOctaveDown: true
    },
    bass: {
        label: "Bass",
        glyph: "\uD834\uDD22",
        referenceDiatonic: 22,
        showOctaveDown: false
    }
};

function parsePitch(pitch) {
    const match = /^([A-Ga-g])([#bn]?)(-?\d+)$/.exec(pitch);
    if (!match) {
        throw new Error('Invalid pitch "' + pitch + '". Use notation like C4, F#4, Bb3, or Bn3 for a natural.');
    }
    const letter = match[1].toUpperCase();
    const accidental = match[2] === 'n' ? '' : match[2];
    const octave = Number(match[3]);
    const offset = NOTE_OFFSETS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    const midi = 12 * (octave + 1) + offset;
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    const diatonic = octave * 7 + LETTER_INDEX[letter];
    return { midi: midi, hz: hz, diatonic: diatonic, letter: letter, octave: octave, accidental: accidental };
}

const MAJOR_KEY_SIGNATURES = {
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7
};
const MINOR_KEY_SIGNATURES = {
    A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7,
    D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7
};

function keySignatureAccidentals(keySpec) {
    const accidentals = {};
    if (!keySpec) return accidentals;
    const isMinor = keySpec.endsWith('m') && keySpec.length > 1;
    const root = isMinor ? keySpec.slice(0, -1) : keySpec;
    const count = (isMinor ? MINOR_KEY_SIGNATURES : MAJOR_KEY_SIGNATURES)[root];
    if (!count) return accidentals;
    const order = count > 0
        ? ['F', 'C', 'G', 'D', 'A', 'E', 'B']
        : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
    for (let i = 0; i < Math.abs(count); i++) {
        accidentals[order[i]] = count > 0 ? '#' : 'b';
    }
    return accidentals;
}

function parseKeyPrefix(tokens) {
    if (tokens.length < 2) return { keySpec: null, consumed: 0 };
    const root = /^([A-Ga-g])([#b]?)$/.exec(tokens[0]);
    const mode = tokens[1].toLowerCase();
    if (!root || (mode !== 'major' && mode !== 'maj' && mode !== 'minor' && mode !== 'min')) {
        return { keySpec: null, consumed: 0 };
    }
    const isMinor = mode === 'minor' || mode === 'min';
    return {
        keySpec: root[1].toUpperCase() + root[2] + (isMinor ? 'm' : ''),
        consumed: 2
    };
}

function parseNotes(noteText, secondsPerBeat) {
    const tokens = noteText.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        throw new Error('Each melody must contain at least one note.');
    }
    const key = parseKeyPrefix(tokens);
    const noteTokens = tokens.slice(key.consumed);
    if (noteTokens.length === 0) {
        throw new Error('Each melody must contain at least one note after the key.');
    }
    const keyAccidentals = keySignatureAccidentals(key.keySpec);
    const notes = [];
    const bars = [];
    let time = 0;
    noteTokens.forEach(token => {
        if (token === '|') {
            bars.push({ afterNoteIndex: notes.length, time: time });
            return;
        }
        const parts = token.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid note "' + token + '". Use Pitch:Beats, for example C4:1, or "|" for a bar separator.');
        }
        const pitch = parts[0];
        const written = /^([A-Ga-g])([#bn]?)(-?\d+)$/.exec(pitch);
        if (!written) {
            throw new Error('Invalid pitch "' + pitch + '". Use notation like C4, F#4, Bb3, or Bn3 for a natural.');
        }
        const beats = Number(parts[1]);
        if (!Number.isFinite(beats) || beats <= 0) {
            throw new Error('Invalid duration in "' + token + '". Beats must be greater than zero.');
        }

        const letter = written[1].toUpperCase();
        const writtenAccidental = written[2].toLowerCase();
        let effectiveAccidental;
        if (writtenAccidental === 'n') {
            effectiveAccidental = '';
        } else if (writtenAccidental === '') {
            effectiveAccidental = keyAccidentals[letter] || '';
        } else {
            effectiveAccidental = writtenAccidental;
        }
        const effectivePitch = letter + effectiveAccidental + written[3];
        const frequency = parsePitch(effectivePitch);
        const duration = beats * secondsPerBeat;
        const note = {
            name: effectivePitch,
            letter: frequency.letter,
            octave: frequency.octave,
            midi: frequency.midi,
            hz: frequency.hz,
            diatonic: frequency.diatonic,
            accidental: frequency.accidental,
            beats: beats,
            start: time,
            duration: duration
        };
        time += duration;
        notes.push(note);
    });
    if (notes.length === 0) {
        throw new Error('Each melody must contain at least one note.');
    }
    return { notes: notes, bars: bars, keySpec: key.keySpec };
}

function vexDurationForBeats(beats) {
    const options = [
        [4, 'w'],
        [3, 'hd'],
        [2, 'h'],
        [1.5, 'qd'],
        [1, 'q'],
        [0.75, '8d'],
        [0.5, '8'],
        [0.375, '16d'],
        [0.25, '16'],
        [0.125, '32']
    ];
    let best = options[options.length - 1];
    let bestDistance = Infinity;
    options.forEach(option => {
        const distance = Math.abs(Math.log(beats / option[0]));
        if (distance < bestDistance) {
            bestDistance = distance;
            best = option;
        }
    });
    return best[1];
}

function isBeamableNote(note) {
    const duration = vexDurationForBeats(note.beats);
    return duration.charAt(0) === '8'
        || duration.charAt(0) === '1'
        || duration.charAt(0) === '3';
}

function parseLocalMelodyList(raw) {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
        ? parsed
        : (parsed && Array.isArray(parsed.melodies) ? parsed.melodies : []);
    return list.filter(melody => melody
        && typeof melody.id === 'string'
        && typeof melody.name === 'string'
        && typeof melody.notes === 'string');
}

function readLocalMelodyDefinitions() {
    const result = [];
    const seen = new Set();
    // Prefer the current key, then fall back to legacy keys. De-duplicate
    // by id so a melody present in more than one key is loaded only once.
    [LOCAL_STORAGE_KEY, ...LEGACY_STORAGE_KEYS].forEach(key => {
        try {
            parseLocalMelodyList(window.localStorage.getItem(key)).forEach(melody => {
                if (!seen.has(melody.id)) {
                    seen.add(melody.id);
                    result.push(melody);
                }
            });
        } catch (err) {
            console.warn('Could not read saved melodies from local storage (' + key + ').', err);
        }
    });
    return result;
}

function writeLocalMelodyDefinitions(definitions) {
    try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(definitions));
        return true;
    } catch (err) {
        console.warn('Could not save melodies to local storage.', err);
        return false;
    }
}

async function loadMelodies() {
    const response = await fetch('melodies.json', { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error('melodies.json returned HTTP ' + response.status);
    }
    const data = await response.json();
    if (!Array.isArray(data.melodies) || data.melodies.length === 0) {
        throw new Error('melodies.json must contain a non-empty "melodies" array.');
    }
    const rawSecondsPerBeat = Number(data.secondsPerBeat);
    const secondsPerBeat = Number.isFinite(rawSecondsPerBeat) && rawSecondsPerBeat > 0
        ? rawSecondsPerBeat
        : 0.6;
    const melodies = {};

    const addMelody = (definition, defaultSecondsPerBeat, source) => {
        if (!definition.id || !definition.name || typeof definition.notes !== 'string') {
            throw new Error('Each melody needs an id, name, and notes string.');
        }
        let id = definition.id;
        if (melodies[id]) {
            if (source === 'server') {
                throw new Error('Duplicate melody id: ' + definition.id);
            }
            let suffix = 1;
            while (melodies[id]) {
                id = definition.id + '-' + suffix;
                suffix += 1;
            }
            definition.id = id;
        }
        const definitionSecondsPerBeat = Number(definition.secondsPerBeat);
        const melodySecondsPerBeat = Number.isFinite(definitionSecondsPerBeat) && definitionSecondsPerBeat > 0
            ? definitionSecondsPerBeat
            : defaultSecondsPerBeat;
        const parsed = parseNotes(definition.notes, melodySecondsPerBeat);
        melodies[id] = {
            id: id,
            name: definition.name,
            rawNotes: definition.notes,
            secondsPerBeat: melodySecondsPerBeat,
            source: source,
            notes: parsed.notes,
            bars: parsed.bars,
            keySpec: parsed.keySpec
        };
    };

    data.melodies.forEach(melody => addMelody(melody, secondsPerBeat, 'server'));

    const localMelodyDefs = [];
    readLocalMelodyDefinitions().forEach(definition => {
        try {
            addMelody(definition, secondsPerBeat, 'local');
            localMelodyDefs.push(definition);
        } catch (err) {
            console.warn('Skipping invalid saved melody.', err);
        }
    });

    const localNames = new Set(localMelodyDefs.map(definition => definition.name.toLowerCase()));
    Object.keys(melodies).forEach(id => {
        if (melodies[id].source === 'server' && localNames.has(melodies[id].name.toLowerCase())) {
            delete melodies[id];
        }
    });

    return {
        melodies: melodies,
        localMelodyDefs: localMelodyDefs,
        secondsPerBeat: secondsPerBeat
    };
}

const PIANO_SAMPLES = {
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    files: {
        48: "C3.mp3",
        51: "Ds3.mp3",
        54: "Fs3.mp3",
        57: "A3.mp3",
        60: "C4.mp3",
        63: "Ds4.mp3",
        66: "Fs4.mp3"
    }
};

class VocalCoachUI {
    constructor(melodies, localMelodyDefs, secondsPerBeat) {
        this.scoreHost = document.getElementById('scoreHost');
        this.overlayCanvas = document.getElementById('coachOverlay');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.pitchCanvas = document.getElementById('pitchCanvas');
        this.pitchCtx = this.pitchCanvas.getContext('2d');
        this.hoverPitchNote = null;
        this.currentNote = null;
        this.audioCtx = null;
        this.analyser = null;
        this.micStream = null;
        this.animationFrameId = null;
        this.scheduledSources = [];
        this.previewSource = null;
        this.pianoSamples = new Map();
        this.pianoLoadPromise = null;
        this.pianoLoadFailed = false;

        this.currentMode = 'idle';
        this.startTime = 0;
        this.userHistory = [];
        this.melodies = melodies;
        this.activeMelody = melodies[Object.keys(melodies)[0]];
        this.localMelodyDefs = localMelodyDefs || [];
        this.secondsPerBeat = secondsPerBeat || 0.6;
        this.activeNotes = [];
        this.activeBars = [];
        this.activeSpeed = 0.6;
        this.totalDuration = 3.5;
        this.hoverNote = null;
        this.clefMode = 'treble8vb';
        this.effectiveClef = 'treble8vb';

        this.scale = 1.8;
        this.staveY = -5;
        this.staveWidth = 430;
        this.pitchLeft = 48;
        this.pitchRight = 16;
        this.pitchMinMidi = 46;
        this.pitchMaxMidi = 66;
        this.vexRenderer = null;
        this.vexContext = null;
        this.vexStave = null;
        this.vexNotes = [];
        this.vexBeams = [];
        this.fontsReady = document.fonts.ready.then(() => {
            VexFlow.setFonts('Bravura', 'Academico');
        }).catch(() => {});

        this.initDOM();
        this.updateClef();
        this.refreshTimeline();
        this.updateSpeedLabel();
        this.initVex();
        this.drawPitchChart(-1, null, null);
    }

    getSpeedFactor() {
        const value = parseFloat(document.getElementById('speedRange').value);
        return Number.isFinite(value) ? value : 0.6;
    }

    updateSpeedLabel() {
        document.getElementById('speedValue').textContent = this.getSpeedFactor().toFixed(2) + 'x';
    }

    getClef() {
        return CLEFS[this.effectiveClef];
    }

    updateClef() {
        this.effectiveClef = this.clefMode;
    }

    toggleClef() {
        if (this.currentMode !== 'idle') return;
        this.clefMode = this.clefMode === 'treble8vb' ? 'bass' : 'treble8vb';
        this.updateClef();
        this.renderStatic();
    }

    async initVex() {
        await this.fontsReady;
        this.scoreHost.innerHTML = '';
        this.vexRenderer = new VexFlow.Renderer(this.scoreHost, VexFlow.Renderer.Backends.SVG);
        this.vexRenderer.resize(800, 200);
        this.vexContext = this.vexRenderer.getContext();
        this.vexContext.scale(this.scale, this.scale);
        await this.renderStaff(-1, null);
    }

    async renderStatic() {
        await this.fontsReady;
        this.renderStaff(-1, null);
        this.drawPitchChart(-1, null, this.hoverPitchNote);
    }

    renderStaff(elapsedTime, hoverNote) {
        this.scoreHost.innerHTML = '';
        this.vexRenderer = new VexFlow.Renderer(this.scoreHost, VexFlow.Renderer.Backends.SVG);
        this.vexRenderer.resize(800, 200);
        this.vexContext = this.vexRenderer.getContext();
        this.vexContext.scale(this.scale, this.scale);

        const clef = this.getClef();
        this.vexStave = new VexFlow.Stave(10, this.staveY, this.staveWidth);
        if (clef.label === 'Treble 8vb') {
            this.vexStave.addClef('treble', 'default', '8vb');
        } else {
            this.vexStave.addClef('bass');
        }
        if (this.activeMelody.keySpec) {
            this.vexStave.addKeySignature(this.activeMelody.keySpec);
        }
        this.vexStave.setContext(this.vexContext).draw();
        this.updateClefHitBox();

        const W = this.overlayCanvas.width;
        const H = this.overlayCanvas.height;
        this.overlayCtx.clearRect(0, 0, W, H);

        const notes = [];
        const isTreble = clef.label === 'Treble 8vb';
        const noteClef = isTreble ? 'treble' : 'bass';
        const keyAccidentals = keySignatureAccidentals(this.activeMelody.keySpec);
        this.activeNotes.forEach(note => {
            const octave = isTreble ? note.octave + 1 : note.octave;
            const key = note.letter.toLowerCase() + (note.accidental || '') + '/' + octave;
            const vexDuration = vexDurationForBeats(note.beats);
            const vexNote = new VexFlow.StaveNote({
                keys: [key],
                duration: vexDuration,
                clef: noteClef
            });
            if (vexDuration.endsWith('d')) {
                VexFlow.Dot.buildAndAttach([vexNote], { all: true });
            }
            const keyAccidental = keyAccidentals[note.letter] || '';
            if (note.accidental !== keyAccidental) {
                vexNote.addModifier(new VexFlow.Accidental(note.accidental || 'n'), 0);
            }
            notes.push(vexNote);
        });

        if (notes.length > 0) {
            VexFlow.Formatter.FormatAndDraw(this.vexContext, this.vexStave, notes);

            const beams = [];
            let beamRun = [];
            const flushBeamRun = () => {
                if (beamRun.length > 1) {
                    beams.push(...VexFlow.Beam.generateBeams(beamRun));
                }
                beamRun = [];
            };
            notes.forEach((vexNote, index) => {
                if (isBeamableNote(this.activeNotes[index])) {
                    beamRun.push(vexNote);
                } else {
                    flushBeamRun();
                }
            });
            flushBeamRun();
            beams.forEach(beam => beam.setContext(this.vexContext).draw());

            this.vexNotes = notes.map((vexNote, i) => {
                const x = vexNote.getAbsoluteX();
                const y = vexNote.getYs ? vexNote.getYs()[0] : 0;
                const bb = vexNote.getBoundingBox ? vexNote.getBoundingBox() : null;
                return {
                    note: this.activeNotes[i],
                    vexNote: vexNote,
                    x: x,
                    y: y,
                    bb: bb ? { x: bb.getX(), y: bb.getY(), w: bb.getW(), h: bb.getH() } : null
                };
            });
            this.vexBeams = beams;
        } else {
            this.vexNotes = [];
            this.vexBeams = [];
        }

        this.renderBarLines();
        this.overlayCtx.clearRect(0, 0, W, H);
        if (elapsedTime >= 0) {
            this.drawPlayhead(elapsedTime);
        }
    }

    renderBarLines() {
        const svg = this.scoreHost.querySelector('svg');
        if (!svg || !this.vexStave || this.activeBars.length === 0) return;
        const namespace = 'http://www.w3.org/2000/svg';
        const top = this.vexStave.getYForLine(0);
        const bottom = this.vexStave.getYForLine(4);
        const staveEnd = this.vexStave.getWidth
            ? this.vexStave.getX() + this.vexStave.getWidth()
            : 440;
        const drawn = new Set();

        this.activeBars.forEach(bar => {
            let x;
            if (bar.afterNoteIndex <= 0) {
                x = this.vexStave.getNoteStartX();
            } else if (bar.afterNoteIndex >= this.vexNotes.length) {
                x = staveEnd;
            } else {
                const previous = this.vexNotes[bar.afterNoteIndex - 1];
                const next = this.vexNotes[bar.afterNoteIndex];
                const previousRight = previous.bb ? previous.x + previous.bb.w : previous.x;
                x = (previousRight + next.x) / 2;
            }

            const key = Math.round(x * 100);
            if (drawn.has(key)) return;
            drawn.add(key);

            const line = document.createElementNS(namespace, 'line');
            line.setAttribute('x1', x);
            line.setAttribute('x2', x);
            line.setAttribute('y1', top);
            line.setAttribute('y2', bottom);
            line.setAttribute('stroke', '#111827');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('class', 'vf-bar-separator');
            svg.appendChild(line);
        });
    }

    updateClefHitBox() {
        this.clefHitBox = null;
        const clefGroup = this.scoreHost.querySelector('.vf-clef');
        if (clefGroup && typeof clefGroup.getBBox === 'function') {
            try {
                const bb = clefGroup.getBBox();
                if (bb.width > 0 && bb.height > 0) {
                    const padding = 8;
                    this.clefHitBox = {
                        x: (bb.x - padding) * this.scale,
                        y: (bb.y - padding) * this.scale,
                        w: (bb.width + padding * 2) * this.scale,
                        h: (bb.height + padding * 2) * this.scale
                    };
                    return;
                }
            } catch (err) {
                /* Fall back to the stave-clef area below. */
            }
        }

        if (this.vexStave) {
            const left = this.vexStave.getX();
            const right = this.vexStave.getNoteStartX();
            const top = this.vexStave.getYForLine(0);
            const bottom = this.vexStave.getYForLine(4);
            this.clefHitBox = {
                x: left * this.scale,
                y: (top - 30) * this.scale,
                w: (right - left) * this.scale,
                h: (bottom - top + 60) * this.scale
            };
        }
    }

    hitTestClef(x, y) {
        const box = this.clefHitBox;
        return !!box
            && x >= box.x && x <= box.x + box.w
            && y >= box.y && y <= box.y + box.h;
    }

    xForTime(elapsedTime) {
        if (this.vexNotes.length === 0) return 0;
        if (elapsedTime <= this.activeNotes[0].start) {
            return this.vexNotes[0].x;
        }

        let index = this.vexNotes.length - 1;
        for (let i = 0; i < this.activeNotes.length; i++) {
            const note = this.activeNotes[i];
            if (elapsedTime >= note.start && elapsedTime <= note.start + note.duration) {
                index = i;
                break;
            }
        }

        const note = this.activeNotes[index];
        const info = this.vexNotes[index];
        const next = this.vexNotes[index + 1];
        const x0 = info ? info.x : 0;
        const x1 = next ? next.x : (info && info.bb ? info.x + info.bb.w : x0);
        const fraction = Math.max(0, Math.min(1, (elapsedTime - note.start) / note.duration));
        return x0 + fraction * (x1 - x0);
    }

    drawPlayhead(elapsedTime) {
        const tx = Math.min(this.xForTime(elapsedTime) * this.scale, 800 - 16);
        this.overlayCtx.strokeStyle = '#2563eb';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(tx, 0);
        this.overlayCtx.lineTo(tx, this.overlayCanvas.height);
        this.overlayCtx.stroke();
    }

    refreshTimeline() {
        this.activeSpeed = this.getSpeedFactor();
        this.activeNotes = this.activeMelody.notes.map(note => ({
            ...note,
            start: note.start / this.activeSpeed,
            duration: note.duration / this.activeSpeed
        }));
        this.activeBars = (this.activeMelody.bars || []).map(bar => ({
            afterNoteIndex: bar.afterNoteIndex,
            time: bar.time / this.activeSpeed
        }));
        this.totalDuration = this.activeNotes.reduce(
            (max, note) => Math.max(max, note.start + note.duration),
            0
        );
    }

    pitchXForTime(t) {
        const duration = this.totalDuration || 3.5;
        const plotWidth = 800 - this.pitchLeft - this.pitchRight;
        return this.pitchLeft + (t / duration) * plotWidth;
    }

    pitchYForMidi(midi) {
        const H = this.pitchCanvas.height;
        const topPad = 24;
        const bottomPad = 26;
        const plotHeight = H - topPad - bottomPad;
        return topPad + (this.pitchMaxMidi - midi) / (this.pitchMaxMidi - this.pitchMinMidi) * plotHeight;
    }

    getPitchRect(note) {
        const duration = this.totalDuration || 3.5;
        const plotWidth = 800 - this.pitchLeft - this.pitchRight;
        const x = this.pitchLeft + (note.start / duration) * plotWidth;
        const w = Math.max(4, (note.duration / duration) * plotWidth);
        const y = this.pitchYForMidi(note.midi);
        const semitonePx = (this.pitchCanvas.height - 24 - 26) / (this.pitchMaxMidi - this.pitchMinMidi);
        const h = Math.max(10, semitonePx * 1.1);
        return { x, y: y - h / 2, w, h };
    }

    hitTestPitchBox(x, y) {
        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const note = this.activeNotes[i];
            const rect = this.getPitchRect(note);
            if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
                return note;
            }
        }
        return null;
    }

    getPitchCoords(event) {
        const rect = this.pitchCanvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (this.pitchCanvas.width / rect.width),
            y: (event.clientY - rect.top) * (this.pitchCanvas.height / rect.height)
        };
    }

    drawPitchChart(elapsedTime, currentNote, hoverNote) {
        const W = this.pitchCanvas.width;
        const H = this.pitchCanvas.height;
        const ctx = this.pitchCtx;
        ctx.clearRect(0, 0, W, H);

        const duration = this.totalDuration || 3.5;
        const plotWidth = W - this.pitchLeft - this.pitchRight;
        const semitonePx = (H - 24 - 26) / (this.pitchMaxMidi - this.pitchMinMidi);

        this.activeNotes.forEach(note => {
            const rect = this.getPitchRect(note);
            const highlighted = note === currentNote || note === hoverNote;

            ctx.fillStyle = highlighted ? 'rgba(165, 202, 240, 0.92)' : 'rgba(215, 227, 242, 0.85)';
            ctx.strokeStyle = highlighted ? '#2563eb' : '#94a3b8';
            ctx.lineWidth = highlighted ? 2 : 1.5;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 4);
            } else {
                ctx.rect(rect.x, rect.y, rect.w, rect.h);
            }
            ctx.fill();
            ctx.stroke();

            if (rect.w > 52) {
                ctx.fillStyle = '#374151';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(note.name, rect.x + rect.w / 2, rect.y + rect.h / 2);
            }
        });

        let previousPoint = null;
        this.userHistory.forEach(pt => {
            if (!pt.targetNote) {
                previousPoint = null;
                return;
            }
            const targetY = this.pitchYForMidi(pt.targetNote.midi);
            const userMidi = 69 + 12 * Math.log2(pt.hz / 440);
            const cents = 1200 * Math.log2(pt.hz / pt.targetNote.hz);
            const cy = targetY - (userMidi - pt.targetNote.midi) * semitonePx;
            const cx = this.pitchXForTime(pt.time);

            let color = '#f59e0b';
            if (Math.abs(cents) <= 35) {
                color = '#10b981';
            } else if (cents > 35) {
                color = '#ef4444';
            }

            if (previousPoint && pt.time - previousPoint.time <= 0.2) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(previousPoint.x, previousPoint.y);
                ctx.lineTo(cx, cy);
                ctx.stroke();
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
            previousPoint = { time: pt.time, x: cx, y: cy };
        });

        if (elapsedTime >= 0) {
            const tx = Math.min(this.pitchXForTime(elapsedTime), W - this.pitchRight);
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx, 24);
            ctx.lineTo(tx, H - 26);
            ctx.stroke();
        }
    }

    hitTestNote(x, y) {
        const sx = this.scale;
        for (let i = this.vexNotes.length - 1; i >= 0; i--) {
            const bb = this.vexNotes[i].bb;
            if (!bb) continue;
            const left = bb.x * sx;
            const top = bb.y * sx;
            const right = (bb.x + bb.w) * sx;
            const bottom = (bb.y + bb.h) * sx;
            if (x >= left && x <= right && y >= top && y <= bottom) {
                return this.vexNotes[i].note;
            }
        }
        return null;
    }

    renderMelodyLinks() {
        const list = document.getElementById('melodyLinks');
        if (!list) return;
        list.innerHTML = '';
        Object.values(this.melodies).forEach(melody => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#' + encodeURIComponent(melody.id);
            link.textContent = melody.name;
            link.dataset.melodyId = melody.id;
            if (melody.id === this.activeMelody.id) {
                link.setAttribute('aria-current', 'true');
            }
            if (melody.source === 'local') {
                link.title = t('savedInBrowser');
            }
            link.addEventListener('click', (event) => {
                event.preventDefault();
                if (this.currentMode !== 'idle') return;
                this.selectMelody(melody.id);
            });
            item.appendChild(link);
            list.appendChild(item);
        });
    }

    selectMelody(id) {
        const melody = this.melodies[id];
        if (!melody) return;
        this.activeMelody = melody;
        this.userHistory = [];
        this.hoverNote = null;
        this.hoverPitchNote = null;
        this.currentNote = null;
        document.getElementById('melodyNotes').value = melody.rawNotes;
        document.getElementById('melodyName').value = melody.name;
        this.updateClef();
        this.refreshTimeline();
        this.renderMelodyLinks();
        this.renderStatic();
        this.setStatus(t('statusLoaded', { name: melody.name }));
    }

    saveMelody() {
        if (this.currentMode !== 'idle') return;
        const notesText = document.getElementById('melodyNotes').value.trim();
        const name = document.getElementById('melodyName').value.trim();
        if (!name) {
            this.setStatus(t('statusEnterName'));
            return;
        }
        if (!notesText) {
            this.setStatus(t('statusEnterNote'));
            return;
        }

        let parsed;
        try {
            parsed = parseNotes(notesText, this.secondsPerBeat);
        } catch (err) {
            this.setStatus(t('statusCannotSave', { error: err.message }));
            return;
        }

        const existingIndex = this.localMelodyDefs.findIndex(
            melody => melody.name.toLowerCase() === name.toLowerCase()
        );
        const id = existingIndex >= 0
            ? this.localMelodyDefs[existingIndex].id
            : 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        const definition = {
            id: id,
            name: name,
            notes: notesText,
            secondsPerBeat: this.secondsPerBeat
        };
        if (existingIndex >= 0) {
            this.localMelodyDefs[existingIndex] = definition;
        } else {
            this.localMelodyDefs.push(definition);
        }
        const stored = writeLocalMelodyDefinitions(this.localMelodyDefs);

        this.melodies[id] = {
            id: id,
            name: name,
            rawNotes: notesText,
            secondsPerBeat: this.secondsPerBeat,
            source: 'local',
            notes: parsed.notes,
            bars: parsed.bars,
            keySpec: parsed.keySpec
        };
        Object.keys(this.melodies).forEach(otherId => {
            if (otherId !== id && this.melodies[otherId].name.toLowerCase() === name.toLowerCase()) {
                delete this.melodies[otherId];
            }
        });
        this.activeMelody = this.melodies[id];
        this.userHistory = [];
        this.hoverNote = null;
        this.hoverPitchNote = null;
        this.updateClef();
        this.refreshTimeline();
        this.renderMelodyLinks();
        this.renderStatic();
        this.setStatus(stored
            ? t('statusSaved', { name: name })
            : t('statusSavedSession', { name: name }));
    }

    initDOM() {
        const melodyNotes = document.getElementById('melodyNotes');
        const melodyName = document.getElementById('melodyName');
        melodyNotes.value = this.activeMelody.rawNotes;
        melodyName.value = this.activeMelody.name;

        document.getElementById('btnSaveMelody').addEventListener('click', () => this.saveMelody());
        [melodyNotes, melodyName].forEach(input => {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.saveMelody();
                }
            });
        });

        this.renderMelodyLinks();

        document.getElementById('speedRange').addEventListener('input', () => {
            this.updateSpeedLabel();
            if (this.currentMode === 'idle') {
                this.userHistory = [];
                this.hoverNote = null;
                this.refreshTimeline();
                this.renderStatic();
            }
        });

        document.getElementById('btnPlay').addEventListener('click', () => this.playTarget());
        document.getElementById('btnRecord').addEventListener('click', () => this.startRecording());
        document.getElementById('btnStop').addEventListener('click', () => this.stopEngine());

        this.scoreHost.addEventListener('click', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            if (this.hitTestClef(x, y)) {
                this.toggleClef();
                return;
            }
            const note = this.hitTestNote(x, y);
            if (note) this.playSingleNote(note);
        });

        this.scoreHost.addEventListener('mousemove', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            const overClef = this.hitTestClef(x, y);
            const note = this.hitTestNote(x, y);
            this.scoreHost.style.cursor = (overClef || note) ? 'pointer' : 'default';
            if (note !== this.hoverNote) {
                this.hoverNote = note;
                if (this.currentMode === 'idle') this.renderStatic();
            }
        });

        this.scoreHost.addEventListener('mouseleave', () => {
            this.scoreHost.style.cursor = 'default';
            if (this.hoverNote) {
                this.hoverNote = null;
                if (this.currentMode === 'idle') this.renderStatic();
            }
        });

        this.pitchCanvas.addEventListener('click', (e) => {
            const { x, y } = this.getPitchCoords(e);
            const note = this.hitTestPitchBox(x, y);
            if (note) this.playSingleNote(note);
        });

        this.pitchCanvas.addEventListener('mousemove', (e) => {
            const { x, y } = this.getPitchCoords(e);
            const note = this.hitTestPitchBox(x, y);
            this.pitchCanvas.style.cursor = note ? 'pointer' : 'default';
            if (note !== this.hoverPitchNote) {
                this.hoverPitchNote = note;
                if (this.currentMode === 'idle') this.drawPitchChart(-1, null, this.hoverPitchNote);
            }
        });

        this.pitchCanvas.addEventListener('mouseleave', () => {
            this.pitchCanvas.style.cursor = 'default';
            if (this.hoverPitchNote) {
                this.hoverPitchNote = null;
                if (this.currentMode === 'idle') this.drawPitchChart(-1, null, null);
            }
        });
    }

    getCanvasCoords(event) {
        const rect = this.scoreHost.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (this.overlayCanvas.width / rect.width),
            y: (event.clientY - rect.top) * (this.overlayCanvas.height / rect.height)
        };
    }

    setStatus(message) {
        document.getElementById('audioStatus').textContent = message;
    }

    async ensurePianoSamples() {
        const expected = Object.keys(PIANO_SAMPLES.files).length;
        if (this.pianoSamples.size === expected) return true;
        if (this.pianoLoadFailed) return false;

        if (!this.pianoLoadPromise) {
            this.setStatus(t('statusLoadingPiano'));
            this.pianoLoadPromise = (async () => {
                try {
                    const entries = Object.entries(PIANO_SAMPLES.files);
                    await Promise.all(entries.map(async ([midi, file]) => {
                        const response = await fetch(PIANO_SAMPLES.baseUrl + file);
                        if (!response.ok) {
                            throw new Error('Failed to load ' + file + ' (' + response.status + ')');
                        }
                        const data = await response.arrayBuffer();
                        const buffer = await this.audioCtx.decodeAudioData(data);
                        this.pianoSamples.set(Number(midi), buffer);
                    }));
                    this.setStatus(t('statusPianoReady'));
                    setTimeout(() => {
                        if (this.pianoSamples.size === expected) this.setStatus('');
                    }, 1500);
                    return true;
                } catch (err) {
                    this.pianoLoadFailed = true;
                    this.setStatus(t('statusPianoFallback'));
                    console.warn('Piano sample loading failed; using sine fallback.', err);
                    return false;
                }
            })();
        }
        return this.pianoLoadPromise;
    }

    nearestSampleMidi(midi) {
        let nearest = null;
        let bestDistance = Infinity;
        this.pianoSamples.forEach((buffer, sampleMidi) => {
            const distance = Math.abs(sampleMidi - midi);
            if (distance < bestDistance) {
                bestDistance = distance;
                nearest = sampleMidi;
            }
        });
        return nearest;
    }

    playPianoNote(note, startTime, duration) {
        const sampleMidi = this.nearestSampleMidi(note.midi);
        if (sampleMidi === null) return null;

        const buffer = this.pianoSamples.get(sampleMidi);
        const source = this.audioCtx.createBufferSource();
        const gainNode = this.audioCtx.createGain();
        const end = startTime + duration;
        const attack = Math.min(0.01, duration * 0.1);
        const release = Math.min(0.25, duration * 0.25);

        source.buffer = buffer;
        source.playbackRate.setValueAtTime(Math.pow(2, (note.midi - sampleMidi) / 12), startTime);

        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.linearRampToValueAtTime(0.8, startTime + attack);
        gainNode.gain.setValueAtTime(0.8, end - release);
        gainNode.gain.linearRampToValueAtTime(0.0001, end);

        source.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        source.start(startTime);
        source.stop(end + 0.02);
        return source;
    }

    playSineNote(hz, startTime, duration) {
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        const end = startTime + duration;
        const attack = Math.min(0.02, duration / 4);
        const release = Math.min(0.02, duration / 4);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + attack);
        gainNode.gain.setValueAtTime(0.2, end - release);
        gainNode.gain.linearRampToValueAtTime(0, end);

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start(startTime);
        osc.stop(end);
        return osc;
    }


    async initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 1024;
        }
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
    }

    scheduleArpeggio(usePiano, startTime) {
        this.activeNotes.forEach(note => {
            const start = startTime + note.start;
            const source = (usePiano && this.playPianoNote(note, start, note.duration))
                || this.playSineNote(note.hz, start, note.duration);
            this.scheduledSources.push(source);
        });
    }

    async playTarget() {
        await this.initAudio();
        const usePiano = await this.ensurePianoSamples();
        this.refreshTimeline();
        this.setButtonsState(true, true, false);
        this.currentMode = 'playback';
        this.userHistory = [];
        this.hoverNote = null;
        this.startTime = this.audioCtx.currentTime;
        this.scheduleArpeggio(usePiano, this.startTime);
        this.renderLoop();
    }

    async playSingleNote(note) {
        await this.initAudio();
        const usePiano = await this.ensurePianoSamples();

        if (this.previewSource) {
            try { this.previewSource.stop(); } catch (err) { /* already stopped */ }
            this.previewSource = null;
        }

        const now = this.audioCtx.currentTime;
        const duration = Math.max(note.duration, 0.15);
        const source = (usePiano && this.playPianoNote(note, now, duration))
            || this.playSineNote(note.hz, now, duration);

        this.previewSource = source;
        source.onended = () => {
            if (this.previewSource === source) this.previewSource = null;
        };
    }

    async startRecording() {
        await this.initAudio();
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const source = this.audioCtx.createMediaStreamSource(this.micStream);
            source.connect(this.analyser);

            const usePiano = await this.ensurePianoSamples();
            this.refreshTimeline();
            this.setButtonsState(true, true, false);
            this.currentMode = 'recording';
            this.userHistory = [];
            this.hoverNote = null;
            this.startTime = this.audioCtx.currentTime + RECORDING_LEAD_IN_SECONDS;
            this.scheduleArpeggio(usePiano, this.startTime);
            this.setStatus(t('statusRecordingLead', { seconds: RECORDING_LEAD_IN_SECONDS }));
            window.setTimeout(() => {
                if (this.currentMode === 'recording') this.setStatus(t('statusRecording'));
            }, RECORDING_LEAD_IN_SECONDS * 1000);

            this.renderLoop();
        } catch (err) {
            alert(t('micDenied', { error: err.message }));
        }
    }

    stopEngine() {
        this.currentMode = 'idle';
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }
        this.scheduledSources.forEach(source => {
            try { source.stop(); } catch (err) { /* already stopped */ }
        });
        this.scheduledSources = [];
        if (this.previewSource) {
            try { this.previewSource.stop(); } catch (err) { /* already stopped */ }
            this.previewSource = null;
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.setButtonsState(false, false, true);
        this.renderStatic();
    }

    setButtonsState(playOff, recOff, stopOff) {
        document.getElementById('btnPlay').disabled = playOff;
        document.getElementById('btnRecord').disabled = recOff;
        document.getElementById('btnStop').disabled = stopOff;
        document.getElementById('melodyNotes').disabled = playOff;
        document.getElementById('melodyName').disabled = playOff;
        document.getElementById('btnSaveMelody').disabled = playOff;
        document.getElementById('speedRange').disabled = playOff;
        document.getElementById('melodyLinks').classList.toggle('is-disabled', playOff);
    }

    autoCorrelate(buffer, sampleRate) {
        const size = buffer.length;
        let mean = 0;
        for (let i = 0; i < size; i++) {
            mean += buffer[i];
        }
        mean /= size;

        const centered = new Float32Array(size);
        let rms = 0;
        for (let i = 0; i < size; i++) {
            const value = buffer[i] - mean;
            centered[i] = value;
            rms += value * value;
        }
        rms = Math.sqrt(rms / size);
        if (rms < 0.007) return -1; // Gate signal floor noise

        const minLag = Math.max(2, Math.floor(sampleRate / 600));
        const maxLag = Math.min(Math.floor(sampleRate / 40), Math.floor(size / 2));
        if (maxLag <= minLag) return -1;

        const correlation = new Float32Array(maxLag + 2);
        let bestCorrelation = 0;
        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            let energyA = 0;
            let energyB = 0;
            const limit = size - lag;
            for (let i = 0; i < limit; i++) {
                const a = centered[i];
                const b = centered[i + lag];
                sum += a * b;
                energyA += a * a;
                energyB += b * b;
            }
            const denominator = Math.sqrt(energyA * energyB);
            correlation[lag] = denominator > 0 ? sum / denominator : 0;
            if (correlation[lag] > bestCorrelation) {
                bestCorrelation = correlation[lag];
            }
        }

        if (bestCorrelation < 0.3) return -1;

        // Prefer the first strong peak so harmonics do not produce an octave-low result.
        const peakThreshold = bestCorrelation * 0.85;
        let chosenLag = -1;
        for (let lag = minLag + 1; lag < maxLag; lag++) {
            if (correlation[lag] >= peakThreshold
                && correlation[lag] >= correlation[lag - 1]
                && correlation[lag] >= correlation[lag + 1]) {
                chosenLag = lag;
                break;
            }
        }
        if (chosenLag < 0) {
            for (let lag = minLag; lag <= maxLag; lag++) {
                if (correlation[lag] === bestCorrelation) {
                    chosenLag = lag;
                    break;
                }
            }
        }
        if (chosenLag < 0) return -1;

        const y0 = correlation[chosenLag - 1];
        const y1 = correlation[chosenLag];
        const y2 = correlation[chosenLag + 1];
        const curvature = y0 - 2 * y1 + y2;
        const offset = curvature !== 0 ? 0.5 * (y0 - y2) / curvature : 0;
        return sampleRate / (chosenLag + Math.max(-0.5, Math.min(0.5, offset)));
    }

    getCurrentTargetNote(elapsedSeconds) {
        return this.activeNotes.find(
            n => elapsedSeconds >= n.start && elapsedSeconds <= (n.start + n.duration)
        ) || null;
    }

    getCurrentTargetHz(elapsedSeconds) {
        const currentNote = this.getCurrentTargetNote(elapsedSeconds);
        return currentNote ? currentNote.hz : 0;
    }

    renderLoop() {
        if (this.currentMode === 'idle') return;

        let elapsed = 0;
        if (this.currentMode === 'playback') {
            elapsed = this.audioCtx.currentTime - this.startTime;
        } else if (this.currentMode === 'recording') {
            elapsed = this.audioCtx.currentTime - this.startTime;

            const buffer = new Float32Array(this.analyser.fftSize);
            this.analyser.getFloatTimeDomainData(buffer);
            const userHz = this.autoCorrelate(buffer, this.audioCtx.sampleRate);
            const targetNote = this.getCurrentTargetNote(elapsed);

            if (userHz > 40 && userHz < 600) { // Valid human register gate bounds
                this.userHistory.push({
                    time: elapsed,
                    hz: userHz,
                    targetHz: targetNote ? targetNote.hz : 0,
                    targetNote: targetNote
                });
            }
        }

        if (elapsed > this.totalDuration + 0.15) {
            this.stopEngine();
            return;
        }

        const currentNote = this.getCurrentTargetNote(elapsed);
        this.currentNote = currentNote;

        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        if (elapsed >= 0) {
            this.drawPlayhead(elapsed);
        }
        this.drawPitchChart(elapsed, currentNote, this.hoverPitchNote);
        this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }


}

// Initialize setup upon thread loading
window.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('audioStatus');
    status.textContent = t('statusLoadingMelodies');
    try {
        const loaded = await loadMelodies();
        status.textContent = '';
        new VocalCoachUI(loaded.melodies, loaded.localMelodyDefs, loaded.secondsPerBeat);
    } catch (err) {
        console.error('Could not load melodies.json.', err);
        status.textContent = t('statusLoadError', { error: err.message });
        document.getElementById('btnPlay').disabled = true;
        document.getElementById('btnRecord').disabled = true;
        document.getElementById('btnSaveMelody').disabled = true;
    }
});
