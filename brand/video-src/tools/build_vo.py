"""Generate VO lines with edge-tts (cached), trim silences, and build the shared timeline.

Timeline (src/timeline.json) is the single timing source for both the Remotion
scenes/captions and the audio mixer (build_audio.py).
"""
import asyncio
import hashlib
import json
import math
import os
import subprocess
import sys

import numpy as np
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = "C:/tech/Clasp/brand/x/video/work"
VO_DIR = os.path.join(WORK, "vo")
FPS = 30
SR = 48000
os.makedirs(VO_DIR, exist_ok=True)


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim(x, thresh_db=-42.0, pre=0.03, post=0.09):
    win = int(0.01 * SR)
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    on = np.where(db > thresh_db)[0]
    if len(on) == 0:
        return x
    a = max(0, on[0] * win - int(pre * SR))
    b = min(len(x), (on[-1] + 1) * win + int(post * SR))
    y = x[a:b].copy()
    fade = int(0.008 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


async def tts(text, voice, rate, out):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)


def line_audio(say, voice, rate):
    key = hashlib.sha1(f"{voice}|{rate}|{say}".encode()).hexdigest()[:16]
    mp3 = os.path.join(VO_DIR, key + ".mp3")
    npy = os.path.join(VO_DIR, key + ".npy")
    if not os.path.exists(mp3):
        for attempt in range(4):
            try:
                asyncio.run(tts(say, voice, rate, mp3))
                break
            except Exception as e:  # network hiccups
                print("tts retry", attempt, e, file=sys.stderr)
        else:
            raise RuntimeError("tts failed: " + say)
    if not os.path.exists(npy):
        y = trim(decode(mp3))
        np.save(npy, y)
        wav = os.path.join(VO_DIR, key + ".wav")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", wav],
            input=y.astype(np.float32).tobytes(), check=True,
        )
    return key, np.load(npy)


def norm(w):
    return "".join(ch for ch in w.lower() if ch.isalnum())


def resolve_beat(spec, lines, scene_from_sec, name):
    """[lineIdx, word|seconds, offset?] -> seconds relative to scene start."""
    li, what = spec[0], spec[1]
    off = spec[2] if len(spec) > 2 else 0.0
    ln = lines[li]
    base = ln["start"] - scene_from_sec
    if isinstance(what, (int, float)):
        return base + what + off
    target, _, nth = what.partition("#")
    nth = int(nth or 1)
    seen = 0
    for w0, _w1, w in ln.get("words", []):
        if norm(w).startswith(norm(target)):
            seen += 1
            if seen == nth:
                return base + w0 + off
    print(f"  ! beat {name}: word '{what}' not found in: {ln['say']}", file=sys.stderr)
    return base + off


def main():
    spec = json.load(open(os.path.join(ROOT, "script.json"), encoding="utf-8"))
    voice, rate = spec["voice"], spec["rate"]
    words_path = os.path.join(VO_DIR, "words.json")
    words = json.load(open(words_path, encoding="utf-8")) if os.path.exists(words_path) else {}
    need = []
    out = {}
    for vid, v in spec["videos"].items():
        t = 0.0
        scenes = []
        for sc in v["scenes"]:
            start = t
            cur = start + sc.get("lead", 0.5)
            lines = []
            for i, ln in enumerate(sc["lines"]):
                if i > 0:
                    cur += ln.get("gap", 0.4)
                cur = round(cur * FPS) / FPS
                key, audio = line_audio(ln["say"], voice, rate)
                dur = len(audio) / SR
                if key not in words:
                    need.append(os.path.join(VO_DIR, key + ".wav"))
                lines.append({"key": key, "start": cur, "dur": dur, "cap": ln["cap"], "say": ln["say"],
                              "words": words.get(key, [])})
                cur += dur
            end = cur + sc.get("tail", 0.6)
            end = max(end, start + sc.get("min", 0))
            f0 = round(start * FPS)
            f1 = round(end * FPS)
            beats = {n: round(resolve_beat(b, lines, f0 / FPS, n) * FPS) for n, b in sc.get("beats", {}).items()}
            scenes.append({
                "id": sc["id"],
                "from": f0,
                "dur": f1 - f0,
                "beats": beats,
                "sfx": sc.get("sfx", []),
                "lines": [
                    {
                        "from": round(l["start"] * FPS) - f0,
                        "dur": math.ceil(l["dur"] * FPS),
                        "cap": l["cap"],
                        "say": l["say"],
                        "key": l["key"],
                        "startSec": l["start"],
                        "durSec": l["dur"],
                        "words": l["words"],
                    }
                    for l in lines
                ],
            })
            t = f1 / FPS
        total = scenes[-1]["from"] + scenes[-1]["dur"]
        out[vid] = {"fps": FPS, "durationInFrames": total, "scenes": scenes}
        print(f"{vid:18s} {total / FPS:6.2f}s  " + "  ".join(f"{s['id']}={s['dur'] / FPS:.1f}" for s in scenes))
    with open(os.path.join(ROOT, "src", "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    with open(os.path.join(VO_DIR, "need_words.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(sorted(set(need))))
    if need:
        print(f"{len(set(need))} lines need word timings (run transcribe.py)")


if __name__ == "__main__":
    main()
