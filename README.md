# Note Scout

A single-page vocal pitch trainer that helps you practice singing in tune. It shows a melody as real staff notation, plays a sampled-piano guide track, records your voice, and plots your pitch trail against each target note in real time.

Everything runs in the browser — no build step, no server-side code.

## Features

- **Staff notation** rendered with [VexFlow 5](https://github.com/0xfe/vexflow): note heads, stems, accidentals, ledger lines, barlines, and clefs.
- **Clef toggle** — click the clef on the staff to switch between treble 8vb (treble sounding an octave lower) and bass. No toolbar control; the clef itself is the click target.
- **Two playback modes:**
  - **Listen Track** — plays the target melody so you can memorize the intervals.
  - **Sing & Record** — captures the microphone, estimates your fundamental frequency (F₀) frame by frame, and plays the guide track in sync.
- **Live pitch feedback** on a time-vs-frequency chart: green for in tune (±35 cents), orange for flat, red for sharp.
- **Tempo adjustment** (0.40×–1.20×, default 0.60×) that scales every note's timing for both playback and recording.
- **Individual note preview** — click any note on the staff or the pitch chart to hear it.
- **Sampled piano** via the [Salamander Grand Piano V3](https://sfzinstruments.github.io/pianos/salamander/) sample set (CC BY 3.0), with a native sine-oscillator fallback.
- **Editable melodies** — edit the notes and name inline, then save to `localStorage`. Saved melodies merge with the shipped list and survive reloads.
- **Localization** — English and German UI. The language is picked from your browser preference (falling back to English), and a flag icon in the header lets you switch manually.

## Running the app

Browsers block fetching local JSON over `file://`, so serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Melody format

Melodies live in [`melodies.json`](melodies.json) as `Pitch:Beats` tokens (scientific pitch notation):

```json
{
  "secondsPerBeat": 0.6,
  "melodies": [
    {
      "id": "major_triad_root",
      "name": "C Major Arpeggio (Root Position)",
      "notes": "C3:1 E3:1 G3:1 C4:1 G3:1.3333"
    }
  ]
}
```

Authoring rules:

- **One token per note:** `Pitch:Beats`, e.g. `C4:1`, `F#4:0.5`, `Bb3:2`.
- **Bar separators:** a standalone `|` marks a barline (no note, no duration).
- **Optional key prefix:** e.g. `Ab major C4:1 D4:1`. Unmarked letters inherit the key signature; use `#`/`b` to override, or `n` to force a natural (e.g. `Bn3`).
- **Beats:** positive decimal numbers. Real duration is `beats × secondsPerBeat` at 1.00×, then divided by the selected speed.
- Keep notes between **Bb2** and **F#4** (MIDI 46–66) to stay inside the pitch chart.

Browsers-saved melodies are stored under the `noteScout.melodies.v1` key in `localStorage`. For backwards compatibility, melodies saved under the legacy `vocalPitchCoach.melodies.v1` key are also loaded.

## Files

- [`index.html`](index.html) — the entire app (markup, styles, and logic).
- [`melodies.json`](melodies.json) — shipped melody definitions.
- [`lang/en.js`](lang/en.js) — English UI strings.
- [`lang/de.js`](lang/de.js) — German UI strings.
- [`spec.md`](spec.md) — full software specification, including the math for pitch detection, tempo scaling, and staff/clef layout.
- `melody input` — working notes/draft for authoring melodies.

## Dependencies

Loaded from a CDN at runtime:

- [VexFlow 5](https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow.js) — staff notation rendering.
- Salamander Grand Piano V3 samples from the Tone.js CDN — piano playback.

## Attribution

Piano samples: [Salamander Grand Piano V3](https://sfzinstruments.github.io/pianos/salamander/) by Alexander Holm, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
