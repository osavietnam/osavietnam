"""Create compact source-image contact sheets for suspicious keyword citations."""

from __future__ import annotations

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "temp_" / "pdfdeps"))

from PIL import Image, ImageDraw

DATA = ROOT / "src" / "data" / "confessions-keyword-index.json"
PAGE_DIR = ROOT / "temp_" / "confessions-index-pages"
OUTPUT_DIR = ROOT / "temp_" / "confessions-keyword-audit"

ROMAN = r"(?:XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)"
VALID = re.compile(rf"\b{ROMAN},\d+\s*\([\d,.\s-]+\)", re.I)
CANDIDATE = re.compile(
    r"(?:\b[IJVX1ilfH][IJVX1ilfH,.']{0,8}\s*)?"
    r"\d{1,3}\s*\([\d,.iIl\s-]+\)",
    re.I,
)


CHAPTER_MAX = {
    "I": 20, "II": 10, "III": 12, "IV": 16, "V": 14, "VI": 16,
    "VII": 21, "VIII": 12, "IX": 13, "X": 43, "XI": 31,
    "XII": 32, "XIII": 38,
}


def suspicious(line: dict) -> bool:
    text = line["displayText"]
    if CANDIDATE.search(VALID.sub("", text)):
        return True
    for reference in line.get("references", []):
        match = re.match(r"^([IVX]+),\s*(\d+)", reference, re.I)
        if not match:
            return True
        book, chapter = match.group(1).upper(), int(match.group(2))
        if book not in CHAPTER_MAX or chapter > CHAPTER_MAX[book]:
            return True
    return False


def main() -> None:
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    records: list[tuple[str, dict]] = []
    for entry in payload["entries"]:
        for line in entry["lines"]:
            if suspicious(line):
                records.append((entry["headword"], line))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for existing in OUTPUT_DIR.glob("sheet-*.png"):
        existing.unlink()
    strips: list[np.ndarray] = []
    current_page = None
    image = None
    for index, (headword, line) in enumerate(records, 1):
        if current_page != line["page"]:
            if image is not None:
                image.close()
            image = Image.open(
                PAGE_DIR / f"page-{line['page']:02d}.png"
            ).convert("RGB")
            current_page = line["page"]
        x0, x1 = (720, 2100) if line["column"] == "left" else (2100, 4300)
        y0, y1 = max(0, line["y"] - 45), min(image.height, line["y"] + 115)
        crop = image.crop((x0, y0, x1, y1))
        crop.thumbnail((1100, 112), Image.Resampling.LANCZOS)
        strip = Image.new("RGB", (1100, 146), (245, 245, 245))
        strip.paste(crop, (0, 34))
        ImageDraw.Draw(strip).text(
            (10, 9),
            f"#{index:02d} | PDF {line['page']} {line['column']} | {headword[:70]}",
            fill=(20, 20, 20),
        )
        strips.append(strip)
    if image is not None:
        image.close()

    for sheet_index in range(0, len(strips), 7):
        group = strips[sheet_index:sheet_index + 7]
        sheet = Image.new("RGB", (1100, 146 * len(group)), (255, 255, 255))
        for row, strip in enumerate(group):
            sheet.paste(strip, (0, row * 146))
        target = OUTPUT_DIR / f"sheet-{sheet_index // 7 + 1:02d}.png"
        sheet.save(target)
    print(f"Wrote {len(records)} suspicious lines to {len(list(OUTPUT_DIR.glob('sheet-*.png')))} sheets")


if __name__ == "__main__":
    main()
