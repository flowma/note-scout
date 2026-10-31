# Software Specification: Note Scout (v1.8)

This document specifies the functional requirements and mathematical model for Note Scout.

## 1. Functional Requirements

*   **Melody selection:** Melodies are listed as links; clicking a link loads that melody. All server-shipped and browser-saved melodies appear automatically.
*   **Melody loading:** On startup the app loads `melodies.json` and merges in browser-saved melodies, showing a clear error if the JSON cannot be loaded.
*   **Melody saving & merge:** A named save updates an existing local melody rather than duplicating it, and overrides a same-named server melody so no duplicate names appear. Server and saved melodies are merged without dropping either source; duplicate local IDs are made unique, and malformed saved entries are skipped without preventing startup.
*   **Key & accidental rendering:** When a key is present, the staff shows the matching key signature. Notes matching it omit the accidental, contradicting notes show the needed accidental, and naturals in a key position show a natural sign. The frequency chart labels the absolute sounding pitch.
*   **Tempo adjustment:** The selected speed scales every note's start time and duration for both playback and recording, and is locked while playback or recording is active.
*   **Recording synchronization:** The guide track and pitch analysis share a single clock, so each pitch sample is compared against the note currently sounding.
*   **Recording lead-in:** Recording begins with one second of silence before the guide track and target timeline start. During the lead-in the staff playhead and pitch feedback stay hidden; the stop time includes the lead-in so the full melody is captured.
*   **Monitoring guidance:** The interface advises using headphones while recording to keep the guide track out of the microphone.
*   **Staff notation:** Each note's rhythmic symbol is chosen from its authored beat value (whole, half, dotted half, quarter, dotted quarter, eighth, dotted eighth, sixteenth, thirty-second), with dots for dotted values. Beams connect only contiguous eighth-or-shorter notes; quarter-and-longer notes stay unbeamed. A `|` token produces a barline.
*   **Pitch chart & feedback:** Below the staff, each target note is drawn as a box spanning its start time and MIDI pitch height, and a playhead marks elapsed time. The user pitch trail is plotted relative to the current target note's pitch level (not at an absolute chromatic coordinate), and consecutive valid frames less than 200 ms apart are connected into a continuous trail. Voice feedback appears only on the chart, never on the staff.
*   **Staff playhead:** The staff playhead traverses each note's horizontal span in proportion to its tempo-scaled start time and duration, staying aligned with the guide track across the full timeline.
*   **Clef lock:** Clef clicks are ignored while playback or recording is active.

## 2. Mathematical Model

*   **Boundary range:**
    *   Minimum: Bb2 (MIDI 46 ≈ 116.54 Hz)
    *   Maximum: F#4 (MIDI 66 ≈ 369.99 Hz)
*   **Frequency → MIDI:**
    $$MIDI = 69 + 12 \times \log_2\left(\frac{f}{440}\right)$$
*   **Pitch deviation (cents):**
    $$\text{Cents} = 1200 \times \log_2\left(\frac{f_{\text{user}}}{f_{\text{target}}}\right)$$
    *   In tune: $\le \pm 35$ cents
    *   Too high: $> +35$ cents
    *   Too low: $< -35$ cents
*   **Tempo scaling** (with speed factor $s$):
    *   $t_{\text{start}} = t_{\text{base}} / s$
    *   $d_{\text{effective}} = d_{\text{base}} / s$
    *   $T_{\text{total}} = \max(t_{\text{start}} + d_{\text{effective}})$
    *   Pitch is unchanged; only timing is scaled.
*   **Staff & clef mapping:**
    *   Diatonic index $D = 7 \times \text{octave} + L$, where $L$ is the letter index (C=0, D=1, E=2, F=3, G=4, A=5, B=6); accidentals do not change $D$.
    *   Treble 8vb: middle line is sounding B3, $D = 27$; staff step $= D - 27$; written an octave above the sounding pitch.
    *   Bass: middle line is D3, $D = 22$; staff step $= D - 22$.
    *   Notes are mapped with the displayed clef (treble for treble 8vb, bass for bass); the wrong mapping places notes roughly an octave off.
    *   Staff lines: even steps $-4, -2, 0, 2, 4$; spaces are the odd steps between them.
    *   Ledger lines: positive steps use $6, 8, \ldots \le \text{step}$; negative steps use $-6, -8, \ldots \ge \text{step}$.

## 3. Layout

*   The interface is a single responsive vertical layout; the footer and legend must never be covered by a visualization canvas.
*   The staff and pitch chart scale to their container width; pointer coordinates are normalized against each element's rendered size for hit testing.
*   The staff/notes compartment is compact, with the stave positioned near the top.
