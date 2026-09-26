"""Summarise genuine capture output; no render timings or aesthetic pass are inferred."""
from pathlib import Path
import collections
import hashlib
import json
import math
import subprocess
from PIL import Image, ImageDraw

root = Path.cwd()
capture_dir = root / "docs/visual/captures/baseline"
log = (root / "output/playwright/visual-baseline.log").read_text("utf-8-sig")
data = json.loads(log.split("### Result\n", 1)[1].split("\n### Ran", 1)[0])
data["sourceCommit"] = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
data["sourceModified"] = bool(subprocess.check_output(["git", "status", "--porcelain"]))
data["sourceHashes"] = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in (root / "src").rglob("*") if p.is_file()}
data["assetsOnDisk"] = [{"path": p.relative_to(root).as_posix(), "bytes": p.stat().st_size,
                         "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                        for p in (root / "public").rglob("*") if p.is_file()]


def pixel_metrics(path):
    # Same documented coarse-grid metric definitions as the QA skill; advisory, not quality scores.
    image = Image.open(path).convert("RGB")
    sx, sy = max(1, image.width // 160), max(1, image.height // 90)
    cols, rows = image.width // sx, image.height // sy
    rgb = [image.getpixel((x * sx, y * sy)) for y in range(rows) for x in range(cols)]
    lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in rgb]
    buckets = collections.Counter((r >> 4, g >> 4, b >> 4) for r, g, b in rgb)
    ordered = sorted(lum)
    edges = sum(max(abs(lum[i] - lum[i + 1]), abs(lum[i] - lum[i + cols])) > 12
                for y in range(rows - 1) for x in range(cols - 1) for i in [y * cols + x])
    return {
        "colorBuckets": len(buckets),
        "colorEntropyBits": round(-sum(n / len(rgb) * math.log2(n / len(rgb)) for n in buckets.values()), 2),
        "edgeDensity": round(edges / ((rows - 1) * (cols - 1)), 3),
        "luminance": {"mean": round(sum(lum) / len(lum), 1), "p5": round(ordered[int(len(lum) * 0.05)], 1),
                      "p95": round(ordered[int(len(lum) * 0.95)], 1),
                      "contrast": round(ordered[int(len(lum) * 0.95)] - ordered[int(len(lum) * 0.05)], 1)},
        "dominantColorShare": round(max(buckets.values()) / len(rgb), 3),
        "blankFrame": max(lum) - min(lum) < 2,
    }


for result in data["results"]:
    path = root / result["webglPath"]
    result["metrics"] = pixel_metrics(path)
    result["rawWebglSha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    result["renderBudget"] = {"status": "pending profile approval", "calls": result["info"]["renderInfo"]["calls"],
                              "triangles": result["info"]["renderInfo"]["triangles"]}
(capture_dir / "meta.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
for viewport in ["desktop", "mobile"]:
    records = [r for r in data["results"] if r["viewport"]["name"] == viewport]
    width, cell_w, cell_h = (1600, 800, 385) if viewport == "desktop" else (1200, 240, 560)
    columns = width // cell_w
    sheet = Image.new("RGB", (width, math.ceil(len(records) / columns) * cell_h), "#eeeae1")
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        image = Image.open(root / record["path"]).convert("RGB")
        image.thumbnail((cell_w - 8, cell_h - 30))
        x, y = (index % columns) * cell_w, (index // columns) * cell_h
        sheet.paste(image, (x, y + 25))
        draw.text((x + 4, y + 5), record["bookmark"]["id"], fill="black")
    sheet.save(capture_dir / f"contact-{viewport}.jpg", quality=92)
print(json.dumps({"captures": len(data["results"]), "assetBytes": sum(p["bytes"] for p in data["assetsOnDisk"]),
                  "gpu": sorted({r["info"]["gpu"] for r in data["results"]}),
                  "blankFrames": [r["bookmark"]["id"] for r in data["results"] if r["metrics"]["blankFrame"]],
                  "runtimeErrors": sorted({e for r in data["results"] for e in r["errors"]})}, indent=2))
