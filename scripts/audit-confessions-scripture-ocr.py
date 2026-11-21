"""Compare the re-OCR'd Scripture index with the site data in source order.

This script is intentionally diagnostic.  It never changes a citation from
the transcription structure and never writes the TypeScript data file.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OCR = ROOT / "temp_" / "confessions-index-ocr-clean-v1.json"
DATA = ROOT / "src" / "data" / "confessions-scripture-index.ts"
OUTPUT = ROOT / "temp_" / "confessions-scripture-ocr-audit.json"

BOOK_BLOCK = re.compile(
    r"\{\s*testament:.*?bookEn:\s*'([^']+)'.*?"
    r"entries:\s*\[(.*?)\]\s*,?\s*\}",
    re.S,
)
ENTRY = re.compile(r"\['([^']+)',\s*\[([^\]]*)\]\]")
QUOTED = re.compile(r"'([^']+)'")
BIBLE_START = re.compile(r"^\s*(\d[\d\s:.,()\-]*)")
ROMAN_START = re.compile(
    r"(?<![A-Za-z])(?:XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I|H)"
    r"\s*[,.:]\s*\d",
    re.I,
)


def site_rows() -> list[dict]:
    source = DATA.read_text(encoding="utf-8")
    rows = []
    for block in BOOK_BLOCK.finditer(source):
        book = block.group(1)
        for entry in ENTRY.finditer(block.group(2)):
            rows.append({
                "book": book,
                "bible": entry.group(1),
                "confessions": QUOTED.findall(entry.group(2)),
            })
    return rows


def normalize_bible(text: str) -> str:
    text = re.sub(r"\s+", "", text)
    # The site uses Vietnamese commas for the first chapter/verse separator
    # and periods for subsequent verses, while the English source mixes
    # colons and commas.  They are equivalent for this order audit.
    text = re.sub(r"[,:.]", ".", text)
    return text.strip(" ,;")


def normalize_confessions(text: str) -> list[str]:
    text = text.replace("H", "II")
    text = re.sub(r"\s+", "", text)
    text = text.replace(".", ",").replace(":", ",")
    pattern = re.compile(
        r"(?:XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)"
        r",\d+,\d+",
        re.I,
    )
    return [match.group(0).upper() for match in pattern.finditer(text)]


def ocr_rows() -> list[dict]:
    payload = json.loads(OCR.read_text(encoding="utf-8"))
    output = []
    for page in (2, 3):
        lines = payload["pages"].get(str(page), [])
        for column in ("left", "right"):
            ordered = sorted(
                (
                    line for line in lines
                    if line["column"] == column and 850 <= float(line["y"]) <= 5250
                ),
                key=lambda line: (line["y"], line["x"]),
            )
            bible_lines = []
            conf_lines = []
            for line in ordered:
                text = line["text"].strip()
                bible = BIBLE_START.match(text)
                roman = ROMAN_START.search(text)
                if bible and ":" in bible.group(1):
                    bible_lines.append({
                        "y": line["y"],
                        "text": normalize_bible(bible.group(1)),
                    })
                    if roman:
                        conf_lines.append({
                            "y": line["y"],
                            "text": text[roman.start():],
                        })
                elif roman:
                    conf_lines.append({"y": line["y"], "text": text[roman.start():]})

            for index, bible in enumerate(bible_lines):
                next_y = bible_lines[index + 1]["y"] if index + 1 < len(bible_lines) else 99999
                values = []
                for candidate in conf_lines:
                    if abs(float(candidate["y"]) - float(bible["y"])) <= 16:
                        values.extend(normalize_confessions(candidate["text"]))
                    elif (
                        float(bible["y"]) + 16 < float(candidate["y"]) < float(next_y) - 16
                        and float(candidate["y"]) - float(bible["y"]) <= 110
                    ):
                        values.extend(normalize_confessions(candidate["text"]))
                output.append({
                    "page": page,
                    "column": column,
                    "y": bible["y"],
                    "bible": bible["text"],
                    "confessions": values,
                })
    return output


def main() -> None:
    expected = site_rows()
    observed = ocr_rows()
    comparison = []
    for index in range(max(len(expected), len(observed))):
        site = expected[index] if index < len(expected) else None
        ocr = observed[index] if index < len(observed) else None
        comparison.append({
            "index": index + 1,
            "site": site,
            "ocr": ocr,
            "sameBible": bool(site and ocr and normalize_bible(site["bible"]) == ocr["bible"]),
            "sameConfessions": bool(
                site and ocr
                and [value.upper() for value in site["confessions"]] == ocr["confessions"]
            ),
        })

    payload = {
        "siteCount": len(expected),
        "ocrCount": len(observed),
        "mismatchCount": sum(
            1 for row in comparison
            if not row["sameBible"] or not row["sameConfessions"]
        ),
        "mismatches": [
            row for row in comparison
            if not row["sameBible"] or not row["sameConfessions"]
        ],
        "rows": comparison,
    }
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Site rows: {len(expected)}; OCR rows: {len(observed)}; "
        f"mismatches: {payload['mismatchCount']}"
    )


if __name__ == "__main__":
    main()
