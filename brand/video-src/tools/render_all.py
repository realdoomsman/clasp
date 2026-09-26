"""Render every video (muted) with Remotion, mux with the mixed audio, write deliverables + posters.

Usage: python tools/render_all.py [video ...]
"""
import json
import os
import subprocess
import sys

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = "C:/tech/Clasp/brand/x/video/work"
DEST = "C:/tech/Clasp/brand/x/video"
NPX = "npx.cmd" if os.name == "nt" else "npx"
IDS = ["launch", "clip-money-flow", "clip-lock-weight", "clip-early-exit", "clip-walkthrough"]


def run(cmd, **kw):
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, cwd=SRC, **kw)


def render(vid):
    raw = os.path.join(WORK, "render", f"{vid}.video.mp4")
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    run([NPX, "remotion", "render", "src/index.ts", vid, raw, "--codec=h264", "--crf=14", "--muted", "--concurrency=14", "--log=error"])
    wav = os.path.join(WORK, "audio", f"{vid}.wav")
    out = os.path.join(DEST, f"{vid}.mp4")
    run([
        "ffmpeg", "-v", "error", "-y", "-i", raw, "-i", wav,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-level", "4.2",
        "-pix_fmt", "yuv420p", "-r", "30", "-g", "60", "-bf", "2",
        "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
        "-shortest", "-movflags", "+faststart", out,
    ])


def posters():
    frames = json.load(open(os.path.join(WORK, "poster_frames.json")))
    tmp = os.path.join(WORK, "posters_final")
    os.makedirs(tmp, exist_ok=True)
    run(["node", "tools/stills.mjs", "launch-poster", tmp, "0", "1"])
    os.replace(os.path.join(tmp, "launch-poster-00000.png"), os.path.join(DEST, "launch-poster.png"))
    for vid, fr in frames.items():
        run(["node", "tools/stills.mjs", vid, tmp, str(fr), "1", '{"captions":false}'])
        os.replace(os.path.join(tmp, f"{vid}-{fr:05d}.png"), os.path.join(DEST, f"{vid}-poster.png"))


if __name__ == "__main__":
    which = [a for a in sys.argv[1:] if a != "--posters"] or IDS
    for v in which:
        render(v)
    if "--posters" in sys.argv or not sys.argv[1:]:
        posters()
