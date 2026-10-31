# Software Specification: Note Scout (v1.8)

This specification defines the functional behavior, architectural layout, data structures, and mathematical formulas for a single-page Note Scout, including tempo adjustment, individual note preview, sampled piano playback, guide-track playback during recording, melody data loaded from a human-readable JSON file and merged with browser-saved melodies, natural staff-notation visualization using VexFlow 5, and a bottom time-versus-frequency pitch chart with note boxes and pitch trail.

## 1. Functional Requirements
*   **Exercise Selection:** The system must show the available melodies as a list of HTML links at the bottom of the page. Clicking a link loads that melody. The shipped `melodies.json` includes three 5-note arpeggios spanning C3 to E4, and every server or browser-saved melody must appear automatically in the link list.
*   **Melody Data Loading:** Melody definitions must be loaded at startup from a separate `melodies.json` file. At the same time, the app must read melodies saved in the browser's `localStorage` and combine both sources into one ordered list, with server melodies first. The app must show a clear error if the JSON file cannot be loaded, including the suggestion to serve the folder over HTTP. Because browsers block `file://` JSON fetches, the app must be served from a local HTTP server.
*   **Melody Editing Fields:** The melody selector must be replaced by a text field containing the current melody in `Pitch:Beats` notation and a name field containing the loaded melody's name. Loading a melody through the bottom links must replace both fields with that melody's name and notes.
*   **Saving Melodies:** After editing the notes field, the user must be able to enter a melody name and save it. Saved melodies must persist in browser `localStorage`, appear immediately in the bottom link list, and survive a page reload. Saving a name that already belongs to a locally saved melody must update that melody rather than create a duplicate. A local save must replace any same-named server melody in the active list so the link list does not show duplicate names.
*   **Local Storage Merge:** When loading the page, server melodies and locally saved melodies must be merged into one list without dropping either source. A locally saved melody must override a server melody with the same name so the link list shows one entry. Duplicate local IDs must be made unique, and malformed saved entries must be skipped without preventing the rest of the app from starting.
*   **Human-Readable Note Format:** Melody notes must be authorable as `Pitch:Beats` tokens (for example `C4:1 F#4:0.5 Bb3:2`). Pitch names must use scientific notation, with optional `#`, `b`, or `n` (natural) accidentals, and beats must be positive numbers scaled by the JSON `secondsPerBeat` value. A standalone `|` token must be accepted as a bar separator that does not add duration. An optional key prefix such as `Ab major`, `F# minor`, or `C maj` may appear before the notes; it adds no duration, is retained in the editable melody string, and determines the pitch of unmarked note letters.
*   **Key-Aware Pitch Spelling:** When a key prefix is present, an unmarked note letter inherits the key signature's accidental. For example, `Ab major B3:1` must sound and be detected as absolute Bb3, but render as a B note without a duplicate flat because the key signature already supplies it. Explicit `#` or `b` overrides the key, and an explicit `n` suffix (for example `Bn3`) forces a natural and renders a natural sign when the key would otherwise alter that letter.
*   **Key Signature Rendering:** When a key prefix is present, the staff must display the matching VexFlow key signature. Notes matching the key signature omit the accidental, notes contradicting it show the needed sharp/flat, and natural notes in a key position show a natural sign. The frequency chart must label the absolute sounding pitch (for example `Bb3`).
*   **Tempo Adjustment:** The system must provide a speed adjuster with a default of $0.60\times$ (deliberately slower than the original $1.00\times$ timing), a selectable range of $0.40\times$ to $1.20\times$, and a step of $0.05\times$. The selected speed must scale every note's start time and duration for both playback and recording, and it must be locked while playback or recording is active.
*   **Individual Note Playback:** Clicking any target note lane in the staff visualization must immediately play that single note independently, using the same sampled piano instrument and the current tempo-scaled note duration.
*   **Sampled Piano Instrument:** Playback and note preview must use the Salamander Grand Piano V3 sample library when the sample files are reachable. Each target note must be transposed from the nearest sampled pitch. If sample loading fails, the system must fall back to the native sine oscillator. The sample source and CC BY 3.0 attribution must be visible in the interface.
*   **Listen / Playback Mode:** Plays the target arpeggio sequence using the sampled piano instrument, allowing the singer to memorize the exact target intervals.
*   **Sing + Record + Detect Mode:** Requests real-time access to the user's microphone, extracts raw frame-by-frame time-domain buffers, and estimates the active fundamental frequency ($F_0$). The target arpeggio must also play as a guide track during recording, using the same sampled piano instrument and the same tempo-scaled timeline as the target blocks.
*   **Recording Synchronization:** The guide track and the recording analysis must share the same start reference (the AudioContext clock), so that pitch samples are compared against the target note that is currently sounding.
*   **Recording Lead-in:** Recording must begin with one second of empty playback before the guide track and target timeline start. During that lead-in the staff playhead and pitch feedback must remain hidden. The recording stop time must include the lead-in so the full melody is still captured.
*   **Monitoring Guidance:** The interface must advise the singer to use headphones during recording to prevent the guide track from bleeding into the microphone and corrupting pitch detection.
*   **Staff Notation Visualization:** Target notes must be drawn as natural staff notation using VexFlow: filled note heads, stems, accidentals, ledger lines, barlines, and clefs including treble 8vb and bass. Each note's rhythmic symbol must be chosen from its authored beat value (whole, half, dotted half, quarter, dotted quarter, eighth, dotted eighth, sixteenth, and thirty-second), and dots must be drawn for dotted values. Beams may only connect contiguous eighth-or-shorter notes; quarter-and-longer notes must remain unbeamed. A `|` token must produce a vertical barline spanning the staff at that point in the melody. Duration boxes and note-name labels must not be displayed.
*   **Clickable Note Spans:** The full horizontal time span of each target note must remain clickable for individual preview even though no duration box is drawn.
*   **Bottom Pitch Chart:** A time-versus-frequency diagram below the staff must draw each target note as a box spanning its start time and MIDI pitch height. The user pitch trail is plotted against the current target note, with green/orange/red cent coloring, and a playhead indicates elapsed time during playback or recording. Consecutive valid pitch frames less than 200 ms apart must be connected into a continuous trail so normal detection gaps do not reduce feedback to isolated dots.
*   **Synchronized Staff Playhead:** The staff playhead must traverse each note's own horizontal span in proportion to that note's tempo-scaled start time and duration. It starts at the left edge of the first note head, reaches the next note head when that note begins, and reaches the right edge of the final note when the final note's duration ends, so it stays aligned with the piano guide track for the full timeline.
*   **Clef Toggle:** The staff must support bass clef and treble 8vb (treble clef sounding an octave below the written pitch). There must be no clef control in the toolbar. The clef drawn at the start of the staff itself is the click target: clicking it switches from treble 8vb to bass, and clicking again switches back. Hovering the clef must show a pointer cursor.
*   **Flexbox Layout:** The page shell, card, and visualization container must use vertical flexbox composition. The notes compartment must be compact and must not overlap the legend or the footer; all visualization, legend, and attribution sections must participate in normal flow.
*   **Clef Lock During Playback:** Clicks on the staff clef must be ignored while playback or recording is active, so the staff does not change underneath a running guide track.
*   **Pitch Feedback Location:** Voice feedback must be painted only on the bottom frequency chart, never on the staff/note system. The staff overlay may show the playhead only.
*   **Real-Time Visualization Matrix:** Displays the user's pitch trail on the frequency chart relative to the current target note's pitch level.
    *   **Too High (Sharp):** Plotted above the current target note's pitch level.
    *   **Too Low (Flat):** Plotted below the current target note's pitch level.
    *   **In-Tune:** Plotted at the current target note's pitch level and highlighted in green.
    *   **Relative Position:** User pitch is positioned relative to the current target note, not at an absolute chromatic coordinate, so the target note and trail stay aligned as the melody moves.

## 2. Mathematical Formulations & Constants
*   **Boundary Range Constraints:**
    *   Minimum Boundary: Bb2 (MIDI Index 46 $\approx$ 116.54 Hz)
    *   Maximum Boundary: F#4 (MIDI Index 66 $\approx$ 369.99 Hz)
*   **Frequency-to-MIDI Converters:**
    $$MIDI = 69 + 12 \times \log_2\left(\frac{f}{440}\right)$$
*   **Pitch Deviation Analytics (Cents Offset):**
    $$\text{Cents Offset} = 1200 \times \log_2\left(\frac{f_{\text{user}}}{f_{\text{target}}}\right)$$
    *   **In-Tune Bracket:** $\le \pm35$ Cents.
    *   **Too High Bracket:** $> +35$ Cents.
    *   **Too Low Bracket:** $< -35$ Cents.
*   **Tempo Scaling:**
    *   **Default Speed:** $s = 0.60$.
    *   **Speed Range:** $0.40 \le s \le 1.20$, step $0.05$.
    *   **Effective Start Time:** $t_{\text{start}} = \frac{t_{\text{base}}}{s}$.
    *   **Effective Duration:** $d_{\text{effective}} = \frac{d_{\text{base}}}{s}$.
    *   **Total Timeline Duration:** $T_{\text{total}} = \max(t_{\text{start}} + d_{\text{effective}})$.
    *   **Precision:** Each note's pitch is unchanged; only its timing is stretched or compressed.
*   **Piano Sample Configuration:**
    *   **Sample Library:** Salamander Grand Piano V3 by Alexander Holm, licensed under CC BY 3.0.
    *   **Sample Base URL:** `https://tonejs.github.io/audio/salamander/`
    *   **Sampled Root MIDI Notes:** C3 (48), D#3 (51), F#3 (54), A3 (57), C4 (60), D#4 (63), F#4 (66).
    *   **Nearest-Sample Selection:** For a requested MIDI note $m$, select the root $r$ that minimizes $|r - m|$.
    *   **Transposition Rate:** $\text{playbackRate} = 2^{(m - r)/12}$.
    *   **Fallback:** If any sample request or decode fails, use a sine oscillator at the exact target frequency.
*   **Staff and Clef Formulations:**
    *   **Diatonic Index:** $D = 7 \times \text{octave} + L$, where $L$ is the letter index (C=0, D=1, E=2, F=3, G=4, A=5, B=6). Accidentals do not change $D$.
    *   **Treble 8vb Reference:** Middle line is sounding B3, $D = 27$. Staff step $= D - 27$. The clef is written an octave above the sounding pitch.
    *   **Bass Clef Reference:** Middle line is D3, $D = 22$. Staff step $= D - 22$.
    *   **VexFlow Clef Mapping:** Every VexFlow `StaveNote` must be constructed with the clef used by the displayed stave (`clef: "treble"` for treble 8vb, `clef: "bass"` for bass). Relying on VexFlow's default treble mapping while drawing a bass stave places notes roughly an octave too low.
    *   **Staff Lines:** Even steps $-4, -2, 0, 2, 4$; spaces are the odd steps between them.
    *   **Ledger Lines:** Positive steps use even steps $6, 8, \ldots \le \text{step}$; negative steps use $-6, -8, \ldots \ge \text{step}$.

## 3. Data Schema: Melody Definitions (`melodies.json`)
```json
{
  "_readme": "Add melodies below. Each notes string is a space-separated list of Pitch:Beats tokens, for example \"C4:1 D4:1 E4:2\". Pitches use scientific notation (C4, F#4, Bb3). One beat lasts secondsPerBeat seconds at 1.00x speed. Keep notes between Bb2 and F#4 to stay visible in the pitch chart.",
  "secondsPerBeat": 0.6,
  "melodies": [
    {
      "id": "major_triad_root",
      "name": "C Major Arpeggio (Root Position)",
      "notes": "C3:1 E3:1 G3:1 C4:1 G3:1.3333"
    },
    {
      "id": "minor_triad_root",
      "name": "C Minor Arpeggio (Root Position)",
      "notes": "C3:1 Eb3:1 G3:1 C4:1 G3:1.3333"
    },
    {
      "id": "major_second_inv",
      "name": "C Major 2nd Inversion Arpeggio",
      "notes": "G3:1 C4:1 E4:1 C4:1 G3:1.3333"
    }
  ]
}
```

### 3.1 Melody Authoring Rules
*   **One token per note:** `Pitch:Beats`, separated by whitespace, for example `C4:1 E4:0.5 G4:2`.
*   **Bar separators:** A standalone `|` token marks a bar boundary. It adds no note and no duration, is retained in the editable notes string, and is drawn as a vertical barline between the surrounding notes in the staff.
*   **Key prefix:** Two optional leading tokens may specify a key, for example `Ab major` or `F# minor`. Accepted mode words are `major`, `maj`, `minor`, and `min`. The prefix controls the displayed key signature, the absolute pitch of unmarked note letters, and accidental spelling, but does not add duration. Use `n` after a letter to force a natural (for example `Bn3`) or `#`/`b` to override the key for that note.
*   **Pitch names:** Scientific pitch notation with optional `#` or `b` accidental, for example `C4`, `F#4`, `Bb3`.
*   **Beats:** Positive decimal numbers. The real duration is `beats × secondsPerBeat` at `1.00x`, then divided by the selected speed.
*   **Timing:** Notes are scheduled consecutively; each note starts when the previous note ends.
*   **Adding a melody:** Add an object with a unique `id`, a display `name`, and a `notes` string to the `melodies` array. The app adds it to the bottom link list automatically.
*   **Validation:** Invalid pitches, malformed tokens, non-positive beats, or duplicate server IDs must prevent startup and display a clear error. Invalid locally saved entries are skipped individually.
*   **Visible range:** Notes between Bb2 (MIDI 46) and F#4 (MIDI 66) fit the chart bounds.

### 3.2 Local Storage Schema

Browser-saved melodies are stored under the `noteScout.melodies.v1` key as a JSON array. For backwards compatibility, melodies saved under the legacy `vocalPitchCoach.melodies.v1` key are also loaded (and de-duplicated by id):

*   Each entry contains `id`, `name`, `notes`, and the `secondsPerBeat` value used when it was saved.
*   `id` must start with `local-` for browser-created melodies. If a saved ID collides with a server ID, the loader appends a numeric suffix to keep both melodies.
*   The `notes` value uses the same `Pitch:Beats` authoring format as `melodies.json`.
*   Saving a melody whose name matches an existing local melody replaces that entry; otherwise a new entry is appended.
*   If `localStorage` is unavailable, saving still updates the in-memory list for the session and reports that browser storage failed.

## 4. Running the App
Because browsers block fetching local JSON from `file://`, serve the folder over HTTP:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000/`.

## 5. Layout Requirements (Flexbox)

The single-page interface must be composed with flexbox so that every compartment occupies its own flow space and the footer can never be covered by a visualization canvas.

*   **Page shell:** `body` is a column flex container (`display: flex; flex-direction: column`) with a consistent gap. The card is centered by the page's max-width and auto margins.
*   **Card:** `.card` is a column flex container (`display: flex; flex-direction: column`) with `gap: 1rem`. Controls, status, visualization, legend, footer, and the melody-link list are flex items in that order.
*   **Controls and legend:** Both wrap with `flex-wrap: wrap` on narrow viewports. The legend uses row gaps and never overflows into the footer.
*   **Melody editor row:** The notes edit field must use a much smaller font size than the other controls and remain compact enough that the name field and Save Melody button stay on the same row at desktop width. The `|` bar separator must remain visible in the notes field. A separate controls row below the melody editor must hold the Speed label, tempo slider, speed value, and transport buttons.
*   **Melody link list:** The melody list is a `<ul>` of HTML links at the bottom of the card, below the footer. It uses a column flex layout so each melody appears on its own line, marks the active melody with `aria-current="true"`, and is visually disabled while playback or recording is active.
*   **Visualization container:** `#canvasContainer` is a column flex container (`display: flex; flex-direction: column`) with `height: auto` and a `12px` gap. It must not use a fixed height that is smaller than its children.
*   **Notes compartment:** The staff/notes compartment (`#staffArea`) is `flex: 0 0 auto`, is capped at `800px` wide, and uses an `800 / 200` aspect ratio. It is vertically smaller than the previous 400px staff area, and the stave is positioned near the top of the compartment so only a small top margin remains. The VexFlow staff, overlay canvas, and hit testing share the same `800 × 200` internal coordinate system.
*   **Pitch chart:** `#pitchCanvas` is `flex: 0 0 auto`, capped at `800px` wide, and is `220px` tall. Its internal drawing resolution remains `800 × 220`.
*   **Footer:** The attribution is a `<footer class="credits">` flex item with `flex: 0 0 auto` and normal-flow margins. It must render below the legend with no absolute positioning, negative margins, or fixed-height container allowed to overlap it.
*   **Responsiveness:** The staff SVG and both canvases scale to their flex-item width via `width: 100%`. Pointer coordinates must be normalized against each element's rendered size before hit testing.
