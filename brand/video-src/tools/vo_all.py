"""Full VO pipeline: TTS + timeline, whisper word timings for new lines, timeline again."""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
WORK = "C:/tech/Clasp/brand/x/video/work"
VO = WORK + "/vo"
VPY = WORK + "/venv/Scripts/python.exe"


def build():
    subprocess.run([sys.executable, os.path.join(HERE, "build_vo.py")], cwd=SRC, check=True)


def merge(tr_path):
    wp = VO + "/words.json"
    words = json.load(open(wp, encoding="utf-8")) if os.path.exists(wp) else {}
    for f, ws in json.load(open(tr_path, encoding="utf-8")).items():
        words[os.path.splitext(os.path.basename(f))[0]] = ws
    json.dump(words, open(wp, "w", encoding="utf-8"))


if os.path.exists(WORK + "/transcript_new.json"):
    merge(WORK + "/transcript_new.json")
build()
need = open(VO + "/need_words.txt", encoding="utf-8").read().strip()
if need:
    subprocess.run([VPY, os.path.join(HERE, "transcribe.py"), "small.en", WORK + "/transcript_new.json", "@" + VO + "/need_words.txt"],
                   cwd=SRC, check=True, stderr=subprocess.DEVNULL)
    merge(WORK + "/transcript_new.json")
    build()
