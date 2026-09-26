"""QA for delivered videos: ffprobe stream facts, EBU R128 loudness of the final AAC audio, contact sheets."""
import json
import os
import re
import subprocess
import sys

DEST = "C:/tech/Clasp/brand/x/video"
WORK = "C:/tech/Clasp/brand/x/video/work"
IDS = ["launch", "clip-money-flow", "clip-lock-weight", "clip-early-exit", "clip-walkthrough"]


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,bit_rate:format=duration,size",
         "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def loudness(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    tail = err[err.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1))
    lra = float(re.search(r"LRA:\s+(-?[\d.]+) LU", tail).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail).group(1))
    return i, lra, tp


def sheet(vid, every):
    out = os.path.join(WORK, f"qa_{vid}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(DEST, f"{vid}.mp4"),
                    "-vf", f"fps=1/{every},scale=480:-1,tile=5x6:padding=4:color=0x222222", "-frames:v", "1", out], check=True)
    return out


if __name__ == "__main__":
    for vid in sys.argv[1:] or IDS:
        p = os.path.join(DEST, f"{vid}.mp4")
        info = probe(p)
        v = next(s for s in info["streams"] if s["codec_type"] == "video")
        a = next(s for s in info["streams"] if s["codec_type"] == "audio")
        i, lra, tp = loudness(p)
        every = 3 if vid == "launch" else 1
        sh = sheet(vid, every)
        print(f"{vid}: {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} | {a['codec_name']} {a['sample_rate']}Hz ch{a['channels']} | "
              f"dur {float(info['format']['duration']):.2f}s | {int(info['format']['size']) / 1e6:.1f} MB | I {i} LUFS, LRA {lra}, TP {tp} dBTP | sheet {sh}")
