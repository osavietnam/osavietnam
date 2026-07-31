"""Re-OCR the complete printed indexes for *The Confessions*.

This pass deliberately does not use the Vietnamese transcription structure to
repair a printed citation.  The PDF is the authority for book, chapter, and
paragraph numbers.  Anchor compatibility is audited only after extraction.

Pages are rendered elsewhere at 600 dpi.  Before OCR, each page is sharpened
when necessary and binarized so the diagonal grey emblem disappears while the
black printed type remains.  Cleaned pages are retained for visual review.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEPS = ROOT / "temp_" / "pdfdeps"
sys.path.insert(0, str(DEPS))

import cv2
import numpy as np


LEGACY_EXTRACTOR_PATH = ROOT / "scripts" / "extract-confessions-keyword-index.py"
spec = importlib.util.spec_from_file_location("legacy_confessions_index", LEGACY_EXTRACTOR_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Cannot load {LEGACY_EXTRACTOR_PATH}")
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


PAGE_DIR = ROOT / "temp_" / "confessions-index-pages"
CLEAN_PAGE_DIR = ROOT / "temp_" / "confessions-index-clean-pages"
RAW_OUTPUT = ROOT / "temp_" / "confessions-index-ocr-clean-v1.json"
KEYWORD_OUTPUT = ROOT / "src" / "data" / "confessions-keyword-index.json"
KEYWORD_LINES_OUTPUT = ROOT / "src" / "data" / "confessions-keyword-lines.json"
COMPARISON_OUTPUT = ROOT / "temp_" / "confessions-index-ocr-comparison-v1.json"

PAGE_FIRST = 2
PAGE_LAST = 37
KEYWORD_FIRST = 4
KEYWORD_LAST = 37
WORKERS = 1
OCR_VERSION = 1
CROP_VERSION = 2
STRUCTURE_VERSION = 9
EMBLEM_THRESHOLD = 180

_ENGINE = None

ROMAN = r"(?:XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)"
REFERENCE = re.compile(
    rf"(?<![A-Za-z]){ROMAN}\s*[,.:]\s*\d+"
    rf"(?:\s*\([\d,.\s\u2013\u2014-]+\))?",
    re.I,
)


def preprocess_page(page: int) -> tuple[int, float]:
    source_path = PAGE_DIR / f"page-{page:02d}.png"
    image = cv2.imread(str(source_path), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise RuntimeError(f"Cannot read {source_path}")

    content = image[700:5750, 500:4500]
    blur_score = float(cv2.Laplacian(content, cv2.CV_64F).var())
    # All pages receive a mild unsharp pass.  A scan that is materially softer
    # receives a stronger pass before binarization.
    amount = 1.65 if blur_score < 1200 else 1.35
    sigma = 1.45 if blur_score < 1200 else 1.10
    sharpened = cv2.addWeighted(
        image,
        amount,
        cv2.GaussianBlur(image, (0, 0), sigma),
        1.0 - amount,
        0,
    )
    cleaned = cv2.threshold(
        sharpened,
        EMBLEM_THRESHOLD,
        255,
        cv2.THRESH_BINARY,
    )[1]

    CLEAN_PAGE_DIR.mkdir(parents=True, exist_ok=True)
    target = CLEAN_PAGE_DIR / f"page-{page:02d}.png"
    if not cv2.imwrite(str(target), cleaned):
        raise RuntimeError(f"Cannot write {target}")
    return page, blur_score


def worker_init() -> None:
    global _ENGINE
    from rapidocr_onnxruntime import RapidOCR

    _ENGINE = RapidOCR(
        rec_model_path=None,
        rec_batch_num=16,
    )


def normalize_source_text(text: str) -> str:
    """Normalize OCR typography without consulting anchors or book structure."""
    text = re.sub(r"\s+", " ", text).strip()
    text = text.translate(str.maketrans({
        "，": ",",
        "．": ".",
        "：": ":",
        "（": "(",
        "）": ")",
        "［": "[",
        "］": "]",
        "’": "'",
    }))

    # In this typeface RapidOCR regularly sees the two vertical strokes of
    # printed ``II`` as ``H``.  Restrict the repair to citation position.
    text = re.sub(
        r"(?<![A-Za-z])H(?=\s*[,.:]\s*\d)",
        "II",
        text,
    )
    text = re.sub(
        r"(?<![A-Za-z])I1(?=\s*[,.:]\s*\d)",
        "II",
        text,
    )
    # Digit/lowercase confusions inside an otherwise recognisable Roman token.
    substitutions = {
        "X1II": "XIII",
        "XI1I": "XIII",
        "X111": "XIII",
        "XIlI": "XIII",
        "XIH": "XIII",
        "X11": "XII",
        "V1II": "VIII",
        "VI1I": "VIII",
        "VIlI": "VIII",
        "V1I": "VII",
    }
    for source, target in substitutions.items():
        text = text.replace(source, target)

    # Conservative prose repairs verified against the cleaned page images.
    # Keep them separate from citation repair so English OCR cleanup can never
    # change a printed book, chapter, or paragraph.
    text = re.sub(r"\bwili\b", "will", text, flags=re.I)
    text = re.sub(r"\biove\b", "love", text, flags=re.I)
    text = re.sub(r"\bunciean\b", "unclean", text, flags=re.I)
    text = re.sub(r"\buncieanness\b", "uncleanness", text, flags=re.I)
    text = text.replace(
        "adoption [chidren of Godj",
        "adoption [children of God]",
    )
    text = text.replace(
        "what I am now [as I writel",
        "what I am now [as I write]",
    )
    text = text.replace(
        "God [singularl made man",
        "God [singular] made man",
    )

    # Standardize punctuation only after an intact Roman token.  Crucially,
    # this never changes the token, chapter, or paragraph value.
    text = re.sub(
        rf"(?<![A-Za-z])({ROMAN})\s*[.:]\s*(?=\d)",
        r"\1,",
        text,
        flags=re.I,
    )
    text = re.sub(r"(\d)\s+\(", r"\1(", text)
    text = re.sub(r"\((\d)\s+(\d)(?=\s*[,.)])", r"(\1\2", text)
    text = re.sub(r",\s*(\d)\s+(\d)(?=\s*[,.)])", r",\1\2", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def ocr_column(page: int, column_name: str, x0: int, x1: int) -> list[dict]:
    global _ENGINE
    if _ENGINE is None:
        worker_init()

    image = cv2.imread(
        str(CLEAN_PAGE_DIR / f"page-{page:02d}.png"),
        cv2.IMREAD_GRAYSCALE,
    )
    if image is None:
        raise RuntimeError(f"Cannot read cleaned page {page}")

    y0, y1 = 700, 5750
    roi = image[y0:y1, x0:x1]
    result, _ = _ENGINE(cv2.cvtColor(roi, cv2.COLOR_GRAY2BGR))
    output: list[dict] = []
    for item in result or []:
        box, recognized, confidence = item
        left = min(float(point[0]) for point in box)
        top = min(float(point[1]) for point in box)
        text = normalize_source_text(recognized)
        if not text:
            continue
        output.append({
            "page": page,
            "column": column_name,
            "x": round(x0 + left),
            "y": round(y0 + top),
            "text": text,
            "confidence": round(float(confidence), 4),
        })
    return sorted(output, key=lambda line: (line["y"], line["x"]))


def ocr_page(page: int) -> tuple[int, list[dict]]:
    # Keyword pages have two prose columns.  Scripture pages retain the same
    # two broad regions in the raw cache and are parsed separately.
    right_edge = 1950 if page <= 3 else 2150
    columns = (
        ("left", 600, 2150),
        ("right", right_edge, 4500),
    )
    lines: list[dict] = []
    for column_name, x0, x1 in columns:
        lines.extend(ocr_column(page, column_name, x0, x1))
    return page, lines


def is_keyword_content(line: dict) -> bool:
    page = int(line["page"])
    y = float(line["y"])
    text = line["text"].strip().casefold()
    if page < KEYWORD_FIRST or y < 850 or y > 5300:
        return False
    if page == KEYWORD_FIRST and y < 1700:
        return False
    return not text.startswith((
        "volume ",
        "the confessions",
        "index ",
        "citations are ",
        "and paragraph",
        "prepared by",
    ))


def keyword_lines(cache: dict[str, list[dict]]) -> list[dict]:
    bases = {"left": 800, "right": 2150}
    output: list[dict] = []
    sequence = 0
    for page in range(KEYWORD_FIRST, KEYWORD_LAST + 1):
        for column in ("left", "right"):
            lines = sorted(
                (
                    line for line in cache.get(str(page), [])
                    if line["column"] == column and is_keyword_content(line)
                ),
                key=lambda line: (line["y"], line["x"]),
            )
            for source in lines:
                sequence += 1
                indent = max(0, round(float(source["x"]) - bases[column]))
                level = 0 if indent < 60 else 1 if indent < 150 else 2
                text = normalize_source_text(source["text"])
                output.append({
                    **source,
                    "sequence": sequence,
                    "indent": indent,
                    "level": level,
                    "text": text,
                    "displayText": text,
                    "tabbedText": "\t" * level + text,
                    "references": [
                        re.sub(r"\s+", "", match.group(0)).replace(".", ",").replace(":", ",")
                        for match in REFERENCE.finditer(text)
                    ],
                })
    return output


def compare_with_legacy(lines: list[dict]) -> dict:
    old_cache = legacy.load_cache()
    old_by_page_column: dict[tuple[int, str], list[dict]] = {}
    for page, old_lines in old_cache.items():
        for line in old_lines:
            old_by_page_column.setdefault((int(page), line["column"]), []).append(line)

    changed: list[dict] = []
    unmatched: list[dict] = []
    for line in lines:
        candidates = old_by_page_column.get((line["page"], line["column"]), [])
        nearest = min(
            candidates,
            key=lambda candidate: abs(float(candidate["y"]) - float(line["y"])),
            default=None,
        )
        if nearest is None or abs(float(nearest["y"]) - float(line["y"])) > 18:
            unmatched.append(line)
            continue
        old_refs = [
            re.sub(r"\s+", "", match.group(0)).replace(".", ",").replace(":", ",")
            for match in REFERENCE.finditer(normalize_source_text(nearest["text"]))
        ]
        new_refs = line["references"]
        if old_refs != new_refs or nearest["text"] != line["text"]:
            changed.append({
                "page": line["page"],
                "column": line["column"],
                "y": line["y"],
                "oldText": nearest["text"],
                "newText": line["text"],
                "oldReferences": old_refs,
                "newReferences": new_refs,
            })
    return {
        "changedCount": len(changed),
        "unmatchedCount": len(unmatched),
        "changed": changed,
        "unmatched": unmatched,
    }


def main() -> None:
    missing = [
        page for page in range(PAGE_FIRST, PAGE_LAST + 1)
        if not (PAGE_DIR / f"page-{page:02d}.png").exists()
    ]
    if missing:
        raise FileNotFoundError(f"Missing rendered pages: {missing}")

    blur_scores = {}
    for page in range(PAGE_FIRST, PAGE_LAST + 1):
        page_number, score = preprocess_page(page)
        blur_scores[str(page_number)] = round(score, 2)
        print(f"Prepared page {page_number}/{PAGE_LAST}: blur={score:.1f}", flush=True)

    cache: dict[str, list[dict]] = {}
    prior_crop_version = 0
    if RAW_OUTPUT.exists():
        try:
            prior = json.loads(RAW_OUTPUT.read_text(encoding="utf-8"))
            if int(prior.get("version", 0)) == OCR_VERSION:
                cache.update(prior.get("pages", {}))
                prior_crop_version = int(prior.get("cropVersion", 0))
        except (OSError, json.JSONDecodeError):
            cache = {}

    # Pages 2-3 use a wider gutter crop than the first interrupted pass.
    if prior_crop_version < CROP_VERSION:
        cache.pop("2", None)
        cache.pop("3", None)
    pages_to_ocr = [
        page for page in range(PAGE_FIRST, PAGE_LAST + 1)
        if str(page) not in cache
    ]
    with ProcessPoolExecutor(max_workers=WORKERS, initializer=worker_init) as executor:
        futures = {
            executor.submit(ocr_page, page): page
            for page in pages_to_ocr
        }
        for future in as_completed(futures):
            page, lines = future.result()
            cache[str(page)] = lines
            RAW_OUTPUT.write_text(
                json.dumps(
                    {
                        "version": OCR_VERSION,
                        "cropVersion": CROP_VERSION,
                        "source": "temp_/index Conf..pdf",
                        "preprocessing": {
                            "emblemRemoved": True,
                            "threshold": EMBLEM_THRESHOLD,
                            "blurScores": blur_scores,
                        },
                        "pages": {
                            key: cache[key]
                            for key in sorted(cache, key=int)
                        },
                    },
                    ensure_ascii=False,
                    indent=2,
                ) + "\n",
                encoding="utf-8",
            )
            print(f"OCR page {page}/{PAGE_LAST}: {len(lines)} lines", flush=True)

    lines = keyword_lines(cache)

    # Reuse hierarchy construction only.  Disable every legacy text/reference
    # repair so no citation can be rewritten from the site anchor structure.
    legacy.normalize_reference_punctuation = normalize_source_text
    legacy.clean_roman_noise = normalize_source_text
    legacy.canonicalize_reference_structure = lambda text: text
    entries = legacy.structure(lines)

    lines_payload = {
        "extractorVersion": STRUCTURE_VERSION,
        "ocrCacheVersion": OCR_VERSION,
        "source": "temp_/index Conf..pdf",
        "readingOrder": "page -> left column top-to-bottom -> right column top-to-bottom",
        "lineCount": len(lines),
        "lines": lines,
    }
    KEYWORD_LINES_OUTPUT.write_text(
        json.dumps(lines_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    payload = {
        "extractorVersion": STRUCTURE_VERSION,
        "ocrCacheVersion": OCR_VERSION,
        "source": "temp_/index Conf..pdf",
        "work": "Tự Thuật",
        "workEn": "The Confessions",
        "indexType": "keyword",
        "entryCount": len(entries),
        "lineCount": len(lines),
        "entries": entries,
    }
    KEYWORD_OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    comparison = compare_with_legacy(lines)
    COMPARISON_OUTPUT.write_text(
        json.dumps(comparison, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(lines)} keyword lines / {len(entries)} entries; "
        f"{comparison['changedCount']} changed OCR rows; "
        f"{comparison['unmatchedCount']} unmatched rows",
        flush=True,
    )


if __name__ == "__main__":
    main()
