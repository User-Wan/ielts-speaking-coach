# Motion: Spoken, Then Settled

## Breath
The current voice mark expands and fades like a calm audio pulse, confirming that Lindsey is speaking without attracting attention away from the sentence.

- **When it applies:** Only to the three green arcs on the active AI sentence card.
- **Technical anchors:** 900-1100ms loop, `ease-in-out`, stagger arcs by 120-150ms, opacity 0.3-1, scale 0.82-1.06.
- **Avoid:** Fast equalizer bars, bouncing cards, flashing backgrounds.

## Resolve
An active sentence settles from uncertain to complete when its local audio playback reaches that sentence boundary.

- **When it applies:** At the end of each spoken sentence.
- **Technical anchors:** Remove 1-1.5px blur and restore opacity over 240-320ms; stop the signal loop at its resting state; reveal translation immediately after the clarity transition begins.
- **Avoid:** Showing the crisp full sentence before playback, typewriter animation that races ahead of audio, or clearing the whole conversation.

## Reveal
New sentence cards enter quietly and stay visually subordinate until they become the current spoken unit.

- **When it applies:** When playback advances to the next sentence.
- **Technical anchors:** 6-8px vertical entrance, 220-300ms, `ease-out`; no overshoot.
- **Avoid:** Spring physics, large slides, modal pop-ins.

## Tensions
- **Breath vs. calm:** The signal must prove liveness without turning the lesson into an audio visualizer.
- **Resolve vs. latency:** Prefer text appearing slightly after speech over appearing ahead of it.
- **Reveal vs. continuity:** Each new card is distinct, but the conversation should still read as one uninterrupted exchange.
