"""Compare RapidOCR and Tesseract citations against the same cleaned images."""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAPID = ROOT / "src" / "data" / "confessions-keyword-lines.json"
TESSERACT_DIR = ROOT / "temp_" / "confessions-tesseract-tsv"
OUTPUT = ROOT / "temp_" / "confessions-dual-ocr-audit.json"

VALID_ROMANS = {
    "I", "II", "III", "IV", "V", "VI", "VII",
    "VIII", "IX", "X", "XI", "XII", "XIII",
}
REF = re.compile(
    r"(?<![A-Za-z])([IVXH1]{1,7})\s*[,.:]\s*(\d+)"
    r"(?:\s*\(([^)]{0,18})\))?",
    re.I,
)


def normalize_ocr_roman(token: str) -> str | None:
    candidate = token.upper().replace("H", "II").replace("1", "I")
    return candidate if candidate in VALID_ROMANS else None


def references(text: str) -> list[dict]:
    output = []
    for match in REF.finditer(text):
        paragraph = re.findall(r"\d+", match.group(3) or "")
        output.append({
            "raw": match.group(0),
            "bookRaw": match.group(1).upper(),
            "book": normalize_ocr_roman(match.group(1)),
            "chapter": int(match.group(2)),
            "paragraph": paragraph,
            "signature": (
                int(match.group(2)),
                tuple(int(value) for value in paragraph),
            ),
        })
    return output


def tesseract_lines(page: int) -> list[dict]:
    path = TESSERACT_DIR / f"page-{page:02d}.tsv"
    groups: dict[tuple[int, int, int, str], list[dict]] = defaultdict(list)
    with path.open(encoding="utf-8", errors="replace", newline="") as stream:
        for row in csv.DictReader(stream, delimiter="\t"):
            text = row.get("text", "").strip()
            if not text or int(row.get("level", 0)) != 5:
                continue
            left = int(row["left"])
            column = "left" if left < 2100 else "right"
            key = (
                int(row["block_num"]),
                int(row["par_num"]),
                int(row["line_num"]),
                column,
            )
            groups[key].append({
                "text": text,
                "left": left,
                "top": int(row["top"]),
                "confidence": float(row["conf"]),
            })

    output = []
    for (_, _, _, column), words in groups.items():
        words.sort(key=lambda word: word["left"])
        output.append({
            "page": page,
            "column": column,
            "x": words[0]["left"],
            "y": min(word["top"] for word in words),
            "text": " ".join(word["text"] for word in words),
            "confidence": round(
                sum(word["confidence"] for word in words) / len(words),
                3,
            ),
        })
    return output


def main() -> None:
    rapid_payload = json.loads(RAPID.read_text(encoding="utf-8"))
    by_page_column: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for page in range(4, 38):
        for line in tesseract_lines(page):
            by_page_column[(page, line["column"])].append(line)

    comparisons = []
    unmatched_rapid = []
    for rapid in rapid_payload["lines"]:
        rapid_refs = references(rapid["text"])
        if not rapid_refs:
            continue
        candidates = by_page_column[(int(rapid["page"]), rapid["column"])]
        tess = min(
            candidates,
            key=lambda line: abs(float(line["y"]) - float(rapid["y"])),
            default=None,
        )
        if tess is None or abs(float(tess["y"]) - float(rapid["y"])) > 45:
            unmatched_rapid.append(rapid)
            continue
        tess_refs = references(tess["text"])
        for rapid_ref in rapid_refs:
            matching = [
                value for value in tess_refs
                if value["signature"] == rapid_ref["signature"]
            ]
            if len(matching) != 1:
                continue
            tess_ref = matching[0]
            if rapid_ref["book"] == tess_ref["book"] and rapid_ref["bookRaw"] in VALID_ROMANS:
                continue
            comparisons.append({
                "page": rapid["page"],
                "column": rapid["column"],
                "rapidY": rapid["y"],
                "tesseractY": tess["y"],
                "rapidText": rapid["text"],
                "tesseractText": tess["text"],
                "rapidReference": rapid_ref,
                "tesseractReference": tess_ref,
                "tesseractLineConfidence": tess["confidence"],
                "rapidMalformed": rapid_ref["bookRaw"] not in VALID_ROMANS,
                "bothReadableDisagreement": bool(
                    rapid_ref["book"] in VALID_ROMANS
                    and tess_ref["book"] in VALID_ROMANS
                    and rapid_ref["book"] != tess_ref["book"]
                ),
            })

    payload = {
        "comparisonCount": len(comparisons),
        "rapidMalformedResolvedByTesseract": sum(
            1 for row in comparisons
            if row["rapidMalformed"] and row["tesseractReference"]["book"]
        ),
        "bothReadableDisagreementCount": sum(
            1 for row in comparisons if row["bothReadableDisagreement"]
        ),
        "unmatchedRapidReferenceLineCount": len(unmatched_rapid),
        "comparisons": comparisons,
        "unmatchedRapidReferenceLines": unmatched_rapid,
    }
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        key: value for key, value in payload.items()
        if key not in {"comparisons", "unmatchedRapidReferenceLines"}
    }, indent=2))


if __name__ == "__main__":
    main()
