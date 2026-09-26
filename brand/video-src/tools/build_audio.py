"""Mix VO + original music bed + sound design for each video from src/timeline.json.

Output: C:/tech/Clasp/brand/x/video/work/audio/<video>.wav (48 kHz stereo, 24-bit),
normalized to -14 LUFS integrated with true peak <= -1.5 dBTP.
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import music  # noqa: E402

SR = music.SR
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = "C:/tech/Clasp/brand/x/video/work"
OUT = os.path.join(WORK, "audio")
os.makedirs(OUT, exist_ok=True)
FPS = 30
TARGET_LUFS = -14.0
TP_LIMIT_DB = -1.5


# ------------------------------------------------------------------ loudness (ITU-R BS.1770-4)
def k_weight(x):
    # Pre-filter (high shelf) and RLB high-pass, coefficients for 48 kHz.
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    n = (len(y) - blk) // hop + 1
    if n <= 0:
        return -70.0
    ms = np.array([np.mean(y[i * hop : i * hop + blk] ** 2, axis=0).sum() for i in range(n)])
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[l > -70]
    if len(g) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def limit_fast(x, ceiling_db=TP_LIMIT_DB):
    """Vectorized variant: lookahead min-filter then symmetric smoothing (never above the needed gain)."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    thr = 10 ** (ceiling_db / 20) * 0.98
    up = np.max(np.abs(signal.resample_poly(x, 4, 1, axis=0)), axis=1)
    peak = up[: len(x) * 4].reshape(-1, 4).max(axis=1)[: len(x)]
    need = np.minimum(1.0, thr / np.maximum(peak, 1e-9))
    w = int(0.004 * SR)
    g = minimum_filter1d(need, size=2 * w + 1, mode="nearest")
    g = minimum_filter1d(uniform_filter1d(g, size=w, mode="nearest"), size=w, mode="nearest")
    g = np.minimum(g, minimum_filter1d(need, size=2 * w + 1, mode="nearest"))
    return x * g[:, None]


# ------------------------------------------------------------------ helpers
def vo_line(key):
    y = np.load(os.path.join(WORK, "vo", key + ".npy")).astype(np.float64)
    y = music.hp(y, 75)
    rms = np.sqrt(np.mean(y**2))
    return y * (10 ** (-20 / 20) / max(rms, 1e-9))


def smooth_env(active, attack=0.06, release=0.35):
    # Downsample to 1 kHz control rate for speed.
    step = SR // 1000
    ctrl = active[::step]
    out = np.empty_like(ctrl, dtype=np.float64)
    cur = 0.0
    au = math.exp(-1 / (attack * 1000))
    ad = math.exp(-1 / (release * 1000))
    for i, v in enumerate(ctrl):
        cur = au * cur + (1 - au) * v if v > cur else ad * cur + (1 - ad) * v
        out[i] = cur
    return np.repeat(out, step)[: len(active)]


def snap(t, grid, offset):
    return offset + round((t - offset) / grid) * grid


def arrangement(vid, tl):
    scenes = tl["scenes"]
    S = {s["id"]: s for s in scenes}
    sec = lambda s: s["from"] / FPS  # noqa: E731
    total = tl["durationInFrames"] / FPS
    end = sec(scenes[-1])
    full = {"pad", "ep", "arp", "bass", "kick", "hats", "clap", "shaker"}
    if vid == "launch":
        rv = S["reveal"]
        a = sec(rv) + rv["beats"]["mark"] / FPS + 22 / FPS  # swell hit
        b = end + 0.1
        n = round((b - a) / 2.5)
        bar = (b - a) / n
        offset = a - math.ceil(a / bar) * bar
        beat = bar / 4
        sn = lambda t: snap(t, beat, offset)  # noqa: E731
        sections = [
            (-10, sn(a), {"pad", "hats", "arp", "bass"}),
            (sn(a), sn(sec(S["how"])), {"pad", "ep", "arp", "bass"}),
            (sn(sec(S["how"])), sn(sec(S["honest"])), full),
            (sn(sec(S["honest"])), b, {"pad", "ep"}),
        ]
        return total, bar, offset, sections, b
    b = end + 0.1
    n = max(4, round(b / 2.5))
    bar = b / n
    offset = 0.0
    sections = [(-10, bar * 1, {"pad", "ep", "arp"}), (bar * 1, b, full)]
    return total, bar, offset, sections, b


def build(vid, tl):
    total = tl["durationInFrames"] / FPS
    n = int(round(total * SR))
    vo = np.zeros((n, 2))
    active = np.zeros(n)
    for s in tl["scenes"]:
        for l in s["lines"]:
            y = vo_line(l["key"])
            i = int(round(l["startSec"] * SR))
            m = min(len(y), n - i)
            vo[i : i + m, 0] += y[:m]
            vo[i : i + m, 1] += y[:m]
            active[max(0, i - int(0.12 * SR)) : i + m] = 1.0
    duck = smooth_env(active)

    _, bar, offset, sections, final_at = arrangement(vid, tl)
    bed = music.render_music(total, bar, offset, sections, final_at)
    bed = bed[:n]
    if len(bed) < n:
        bed = np.pad(bed, ((0, n - len(bed)), (0, 0)))
    # Fade the very end so the file ends in silence.
    fade = int(0.8 * SR)
    bed[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2

    fx = np.zeros((n + SR * 3, 2))
    for s in tl["scenes"]:
        for cue, kind, off in s.get("sfx", []):
            base = s["from"] if cue == "start" else s["from"] + s["beats"][cue]
            snd, anchor = music.sfx(kind)
            music.place(fx, snd, (base + off) / FPS - anchor)
    fx = fx[:n]

    # Level the stems: music bed ~ -23 LUFS unducked, ducked ~8 dB under VO.
    bed *= 10 ** ((-23 - lufs(bed)) / 20)
    gain_music = 1 - 0.6 * duck
    mix = vo * 10 ** ((-15.5 - lufs(vo)) / 20) + bed * gain_music[:, None] + fx * 0.9
    mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
    mix = limit_fast(mix)
    # Re-trim loudness after limiting (limiter barely engages), then limit again for safety.
    mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
    mix = limit_fast(mix)
    stats = {"lufs": round(lufs(mix), 2), "tp": round(true_peak_db(mix), 2), "dur": round(len(mix) / SR, 3)}
    path = os.path.join(OUT, vid + ".wav")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", path],
        input=mix.astype(np.float64).tobytes(),
        check=True,
    )
    # Stems for review.
    for name, x in (("music", bed * gain_music[:, None]), ("vo", vo)):
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s16le", os.path.join(OUT, f"{vid}.{name}.wav")],
            input=(x * 0.5).astype(np.float64).tobytes(),
            check=True,
        )
    print(vid, stats, f"bar={bar:.3f}s bpm={240 / bar:.1f}")
    return stats


if __name__ == "__main__":
    tl_all = json.load(open(os.path.join(ROOT, "src", "timeline.json"), encoding="utf-8"))
    which = sys.argv[1:] or list(tl_all)
    for vid in which:
        build(vid, tl_all[vid])
