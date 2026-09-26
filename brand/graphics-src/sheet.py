import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
w = 800
rows = []
for im in ims:
    rows.append(im.resize((w, round(im.height * w / im.width)), Image.LANCZOS))
cols = 2
H = 0; grid = []
for i in range(0, len(rows), cols):
    r = rows[i:i+cols]; h = max(x.height for x in r); grid.append((r, h)); H += h + 10
sheet = Image.new("RGB", (cols * w + 10, H), "white")
y = 0
for r, h in grid:
    x = 0
    for im in r: sheet.paste(im, (x, y)); x += w + 10
    y += h + 10
sheet.save(out)
