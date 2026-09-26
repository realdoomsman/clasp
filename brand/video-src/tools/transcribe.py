"""Transcribe audio files with faster-whisper (word timestamps) for VO/caption QA.
Run with the work venv python: transcribe.py <model> <out.json> <file>... | @listfile
"""
import json
import sys

from faster_whisper import WhisperModel

model = WhisperModel(sys.argv[1], device="cpu", compute_type="int8")
out_path = sys.argv[2]
files = sys.argv[3:]
if len(files) == 1 and files[0].startswith("@"):
    files = [l.strip() for l in open(files[0][1:], encoding="utf-8") if l.strip()]
out = {}
for f in files:
    segs, _ = model.transcribe(f, language="en", word_timestamps=True, beam_size=5)
    words = []
    for s in segs:
        for w in s.words:
            words.append([round(w.start, 3), round(w.end, 3), w.word.strip()])
    out[f] = words
    print(f.replace("\\", "/").split("/")[-1], "|", " ".join(w[2] for w in words), flush=True)
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(out, fh, indent=1)
