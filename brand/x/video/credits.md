# Credits and licenses — Clasp videos

Covers `launch.mp4`, `clip-money-flow.mp4`, `clip-lock-weight.mp4`, `clip-early-exit.mp4` and `clip-walkthrough.mp4`.

## Music: original, no third-party audio

- The music bed in every video was written and synthesized for Clasp in `brand/video-src/tools/music.py` using numpy and scipy. It is pure synthesis with no samples, loops or presets from anyone else. The parts are a detuned-saw pad, an FM electric piano, a pluck arpeggio, a sine sub bass and synthesized kick, clap, hats and shaker. The progression is Dmaj9 – Bm9 – Gmaj9 – A(add9)sus at about 93–101 BPM, fitted to each video so the last chord lands on the end card.
- License: original work made for Clasp. No attribution needed and no third-party rights.

## Sound design: original

- The whooshes, ticks, pops, UI clicks, low hits and the reverse swell are also synthesized in `tools/music.py` (`sfx_*` functions), from filtered noise and sine or FM tones. No sample libraries.

## Voice-over

- Neural text-to-speech made with [edge-tts](https://github.com/rany2/edge-tts) (GPL-3.0 tool), which uses Microsoft Edge's online "Read aloud" neural voices. The voice is `en-US-AndrewMultilingualNeural` at rate `+8%`. Each sentence was generated separately and placed on the timeline with pauses (`tools/build_vo.py`).
- The brief asked for this tool. Microsoft publishes no separate license for Read-aloud output. If you need formal commercial rights to the voice, re-voice the lines in `script.md` with a licensed TTS or a human. Timing comes from the audio, so rerun `tools/vo_all.py` and the render.
- Voice selection. Six voices were generated reading the same test paragraph: Andrew Multilingual, Brian Multilingual, Ava Multilingual, Emma Multilingual, Andrew and Christopher. The pick was Andrew Multilingual. It had natural pitch movement (about 4.0 semitones SD, while Brian Multilingual was a flatter 2.6), even pacing, and a calm, low register that fits the builder tone. Every final line was transcribed back with faster-whisper (small.en) to check intelligibility and to get word timings for animation sync. "memecoin" is spoken as "meme coin" so it's pronounced right. "ETH" is spoken as letters.

## Fonts (burned into the video)

- Outfit (Rodrigo Fuenzalida) and Inter (Rasmus Andersson), both [SIL Open Font License 1.1](https://openfontlicense.org), taken from github.com/google/fonts.

## Imagery

- The UI shots are real captures of the public site https://clasp.fun: the existing shots in `brand/x/shots/` plus fresh headless captures of the lock-panel states (`tools/capture.mjs`). The coin shown is Clasp's own throwaway test coin, $CLTEST, and it's labelled on screen as a test coin, not an investment.
- The Clasp mark, diagrams, charts and icons were drawn in code. There are no stock photos, AI images or third-party graphics.

## Mix

- Mixed in `tools/build_audio.py`. The music ducks about 8 dB under the voice, and each file is normalized to −14 LUFS integrated (ITU-R BS.1770) with a true-peak limit of −1.5 dBTP. Measured on the final MP4s (AAC 256 kb/s, 48 kHz) with ffmpeg `ebur128=peak=true`:
  - launch.mp4: −14.1 LUFS, true peak −1.5 dBTP
  - clip-money-flow.mp4: −14.1 LUFS, −1.4 dBTP
  - clip-lock-weight.mp4: −14.1 LUFS, −1.6 dBTP
  - clip-early-exit.mp4: −14.1 LUFS, −1.5 dBTP
  - clip-walkthrough.mp4: −14.1 LUFS, −1.5 dBTP
