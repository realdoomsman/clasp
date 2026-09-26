import json, os, sys
from PIL import Image

for raw, out, w, h in json.load(open(sys.argv[1])):
    im = Image.open(raw).convert("RGB")
    im = im.resize((w, h), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, optimize=True)
    print(f"  {os.path.basename(out)} {w}x{h} {os.path.getsize(out) / 1024:.0f} KB")
