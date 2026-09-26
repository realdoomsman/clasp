"""Original music bed + sound design, synthesized from scratch with numpy (no samples, no third-party audio).

Style: calm, confident, modern. Warm pad, FM electric piano, pluck arpeggio, sub bass, soft drums.
All parts are arranged against the video timeline (section changes and the final chord land on scene cues).
"""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(1234)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def adsr(n, a, d, s, r, sr=SR):
    """Linear-attack, exponential decay/release envelope of n samples (release included at the end)."""
    a_n, d_n, r_n = int(a * sr), int(d * sr), int(r * sr)
    a_n = max(a_n, 16)
    env = np.empty(n)
    t = np.arange(n)
    env[:] = s
    env[: min(a_n, n)] = np.linspace(0, 1, a_n)[: min(a_n, n)]
    if d_n > 0 and a_n < n:
        k = np.arange(min(d_n * 6, n - a_n))
        env[a_n : a_n + len(k)] = s + (1 - s) * np.exp(-k / max(d_n, 1))
    if r_n > 0 and n > r_n:
        env[n - r_n :] *= np.linspace(1, 0, r_n) ** 2
    del t
    return env


def lp(x, fc, order=2):
    sos = signal.butter(order, fc, "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def place(buf, x, t, gain=1.0, pan=0.0):
    """Mix mono or stereo x into stereo buf at time t (s) with equal-power pan."""
    i = int(round(t * SR))
    if i >= len(buf):
        return
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], axis=1)
    j0 = max(0, -i)
    i0 = max(0, i)
    n = min(len(x) - j0, len(buf) - i0)
    if n > 0:
        buf[i0 : i0 + n] += x[j0 : j0 + n] * gain


def reverb_ir(seconds=2.4, predelay=0.02, damp=4200):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / seconds)[:, None]
    ir = lp(ir, damp)
    ir[: int(predelay * SR)] = 0
    ir /= np.sqrt(np.sum(ir**2, axis=0, keepdims=True))
    return ir


IR = reverb_ir()


def reverb(x, wet):
    out = np.stack([signal.fftconvolve(x[:, c], IR[:, c])[: len(x)] for c in range(2)], axis=1)
    return x + wet * out


# ------------------------------------------------------------------ instruments
def pad_note(freq, dur, amp):
    n = int((dur + 1.6) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for c, det in enumerate((-6, 6)):
        for k, cents in enumerate((0, det, -det * 0.5)):
            f = freq * 2 ** (cents / 1200)
            ph = rng.uniform(0, 1)
            saw = 2 * ((f * t + ph) % 1) - 1
            out[:, c] += saw * (0.5 if k == 0 else 0.35)
    out = lp(out, min(3400, freq * 8), order=2)
    env = adsr(n, 0.9, 0.0, 1.0, 1.6)
    return out * env[:, None] * amp


def ep_note(freq, amp, dur=1.8):
    """FM electric piano: 1:1 body with decaying index + a faint high tine."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 1.3 * np.exp(-t * 3.5) + 0.15
    mod = np.sin(2 * np.pi * freq * t)
    body = np.sin(2 * np.pi * freq * t + idx * mod)
    tine = np.sin(2 * np.pi * freq * 14 * t) * np.exp(-t * 40) * 0.08
    env = np.exp(-t * 1.6) * np.minimum(1, t / 0.004)
    env[-int(0.05 * SR) :] *= np.linspace(1, 0, int(0.05 * SR))
    x = (body + tine) * env * amp
    return lp(x, 3800)


def pluck_note(freq, amp, dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t) * np.exp(-t * 12)
    env = np.exp(-t * 5.5) * np.minimum(1, t / 0.003)
    env[-int(0.03 * SR) :] *= np.linspace(1, 0, int(0.03 * SR))
    return x * env * amp


def bass_note(freq, dur, amp):
    n = int((dur + 0.08) * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(4 * np.pi * freq * t)
    env = adsr(n, 0.006, 0.35, 0.65, 0.08)
    return lp(x * env * amp, 900)


def kick(amp):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 400) * 0.12
    return (x + click) * amp


def clap(amp):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 4200)
    env = np.exp(-t * 22)
    for d in (0.0, 0.011, 0.022):
        env = np.maximum(env, np.exp(-np.maximum(t - d, 0) * 90) * (t >= d))
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30) * 0.4
    return (noise * env + body) * amp


def hat(amp, open_=False):
    n = int((0.25 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7200)
    return x * np.exp(-t * (14 if open_ else 55)) * amp


def shaker(amp):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 4500, 11000)
    env = np.sin(np.pi * np.minimum(t / 0.09, 1)) ** 2
    return x * env * amp


# ------------------------------------------------------------------ sound design
def sfx_whoosh(amp=0.5, dur=0.55):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    # Sweep a band upward via time-varying mix of bands.
    lo = bp(x, 250, 900)
    mid = bp(x, 900, 2800)
    hi = bp(x, 2800, 8000)
    p = t / dur
    y = lo * (1 - p) + mid * np.sin(np.pi * p) + hi * p * 0.6
    env = np.sin(np.pi * np.clip(p, 0, 1)) ** 1.6 * np.where(p < 0.62, p / 0.62, 1) ** 0.5
    y = y * env
    pan = np.linspace(-0.5, 0.5, n)
    l = np.cos((pan + 1) * np.pi / 4) * 1.414
    r = np.sin((pan + 1) * np.pi / 4) * 1.414
    st = np.stack([y * l, y * r], axis=1)
    return reverb_small(st) * amp


def reverb_small(st):
    ir = IR[: int(0.8 * SR)] * np.exp(-np.arange(int(0.8 * SR)) / SR * 6)[:, None]
    wet = np.stack([signal.fftconvolve(st[:, c], ir[:, c])[: len(st)] for c in range(2)], axis=1)
    return st + 0.25 * wet


def sfx_tick(amp=0.35, freq=2200):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t * 60) + 0.5 * np.sin(2 * np.pi * freq * 1.5 * t) * np.exp(-t * 90)
    return x * amp


def sfx_pop(amp=0.45):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 520 + 380 * (1 - np.exp(-t * 40))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16) * np.minimum(1, t / 0.002)
    return lp(x, 3000) * amp


def sfx_click(amp=0.35):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 3000) * np.exp(-t * 500) * 0.6 + np.sin(2 * np.pi * 3100 * t) * np.exp(-t * 180)
    return x * amp


def sfx_low(amp=0.6):
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * (58 + 20 * np.exp(-t * 18)) * t) * np.exp(-t * 5) * np.minimum(1, t / 0.004)
    return x * amp


def sfx_swell(amp=0.45, dur=1.4):
    """Reverse-swell riser ending at the cue, then a soft sub hit."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 600, 6000)
    env = (t / dur) ** 3
    riser = x * env
    hit_n = int(0.9 * SR)
    th = np.arange(hit_n) / SR
    hit = np.sin(2 * np.pi * 55 * th) * np.exp(-th * 4.5) * 1.3
    y = np.concatenate([riser, hit])
    st = np.stack([y, y], axis=1)
    return reverb_small(st) * amp, dur  # dur = offset of the peak within the sound


# ------------------------------------------------------------------ arrangement
CHORDS = [
    # Dmaj9, Bm9, Gmaj9, A(add9)sus
    ([50, 57, 61, 64, 66], 38),
    ([47, 54, 57, 61, 62], 35),
    ([43, 50, 54, 57, 59], 31),
    ([45, 52, 57, 59, 62], 33),
]
ARP = [0, 2, 3, 4, 3, 2, 4, 1]  # indices into chord tones (+12)
FINAL = ([50, 57, 61, 64, 66, 69], 38)


def render_music(total, bar, offset, sections, final_at=None):
    """sections: list of (t_start, t_end, set_of_layers). Layers: pad, ep, arp, bass, kick, hats, clap, shaker.
    offset: time of bar 0 (may be negative). final_at: time of the final chord (pad+ep ring out, all else stops)."""
    n = int((total + 3) * SR)
    pad = np.zeros((n, 2))
    keys = np.zeros((n, 2))
    drums = np.zeros((n, 2))
    bass = np.zeros((n, 2))
    beat = bar / 4

    def layers_at(t):
        for a, b, L in sections:
            if a <= t < b:
                return L
        return set()

    k0 = int(np.floor((0 - offset) / bar)) - 1
    k1 = int(np.ceil((total - offset) / bar)) + 1
    for k in range(k0, k1):
        t_bar = offset + k * bar
        if final_at is not None and t_bar >= final_at - 1e-6:
            break
        notes, root = CHORDS[k % 4]
        L = layers_at(max(t_bar, 0) + 0.01)
        if "pad" in L:
            for m in notes:
                place(pad, pad_note(mtof(m), bar, 0.09), t_bar, pan=rng.uniform(-0.3, 0.3))
        for b in range(4):
            tb = t_bar + b * beat
            Lb = layers_at(tb + 0.01)
            if "ep" in Lb and b in (0, 2):
                for j, m in enumerate(notes[1:]):
                    place(keys, ep_note(mtof(m + 12), 0.12 if b == 0 else 0.08), tb + j * 0.012, pan=-0.2 + 0.1 * j)
            if "bass" in Lb:
                pattern = {0: (root, 0.9 * beat), 2: (root, 0.45 * beat)}
                if b in pattern:
                    m, d = pattern[b]
                    place(bass, bass_note(mtof(m), d, 0.2), tb)
                if b == 1:
                    place(bass, bass_note(mtof(root), 0.4 * beat, 0.14), tb + beat * 0.5)
                if b == 3:
                    place(bass, bass_note(mtof(root + 7), 0.4 * beat, 0.12), tb + beat * 0.5)
            if "kick" in Lb and b in (0, 2):
                place(drums, kick(0.32), tb)
            if "kick" in Lb and b == 2:
                place(drums, kick(0.16), tb + beat * 0.75)
            if "clap" in Lb and b in (1, 3):
                place(drums, clap(0.2), tb, pan=0.05)
            for e in range(2):
                te = tb + e * beat / 2
                Le = layers_at(te + 0.01)
                if "hats" in Le:
                    place(drums, hat(0.15 if e == 1 else 0.08), te, pan=0.25)
                if "shaker" in Le:
                    place(drums, shaker(0.05 if e == 1 else 0.03), te + beat / 4, pan=-0.25)
                if "arp" in Le:
                    step = (b * 2 + e) % 8
                    m = notes[1:][ARP[step] % 4] + 12
                    place(keys, pluck_note(mtof(m), 0.09 if e == 0 else 0.065), te, pan=0.35 if step % 2 else -0.35)
    if final_at is not None:
        notes, root = FINAL
        for m in notes:
            place(pad, pad_note(mtof(m), 3.2, 0.09), final_at - 0.05)
        for j, m in enumerate(notes[1:]):
            place(keys, ep_note(mtof(m + 12), 0.12, dur=4.0), final_at + j * 0.02, pan=-0.2 + 0.08 * j)
        place(bass, bass_note(mtof(root), 2.0, 0.2), final_at)
        place(drums, kick(0.3), final_at)
    mix = reverb(pad, 0.25) + reverb(keys, 0.35) + reverb(drums, 0.08) * 0.9 + bass
    mix = hp(mix, 30)
    return mix[: int(total * SR)]


def sfx(kind):
    """Returns (stereo sound, anchor offset in s). Anchor = moment that should land on the cue."""
    if kind == "whoosh":
        return sfx_whoosh(), 0.36
    if kind == "tick":
        s = sfx_tick()
        return np.stack([s, s], axis=1), 0.0
    if kind == "pop":
        s = sfx_pop()
        return np.stack([s, s], axis=1), 0.0
    if kind == "click":
        s = sfx_click()
        return np.stack([s, s], axis=1), 0.0
    if kind == "low":
        s = sfx_low()
        return np.stack([s, s], axis=1), 0.0
    if kind == "swell":
        return sfx_swell()
    raise ValueError(kind)
