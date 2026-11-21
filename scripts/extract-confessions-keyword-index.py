"""OCR and structure the subject index from ``temp_/index Conf..pdf``.

The PDF pages are scans.  Text is segmented into printed lines with OpenCV,
then sent to RapidOCR in recognition-only mode.  Per-page OCR is cached so an
interrupted run can resume without repeating completed pages.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPS = ROOT / "temp_" / "pdfdeps"
sys.path.insert(0, str(DEPS))

import cv2
import numpy as np

PDF = ROOT / "temp_" / "index Conf..pdf"
PAGE_DIR = ROOT / "temp_" / "confessions-index-pages"
RAW_CACHE = ROOT / "temp_" / "confessions-keyword-ocr-raw.json"
OUTPUT = ROOT / "src" / "data" / "confessions-keyword-index.json"
LINES_OUTPUT = ROOT / "src" / "data" / "confessions-keyword-lines.json"
PDFTOPPM = shutil.which("pdftoppm")

PAGE_FIRST = 4
PAGE_LAST = 37
SCALE_DPI = 600
THRESHOLD_SEGMENT = 145
THRESHOLD_RECOGNITION = 165
WORKERS = 3
OCR_VERSION = 4
STRUCTURE_VERSION = 8

# A line that straddles the old/new OCR crop boundary was recognized twice.
# The second recognition is visibly the same printed line as y=1275, with
# ``sin and, I,7(11)`` degraded to ``sin amd, I,t1 11``.
LINE_EXCLUSIONS = {
    (6, "left", 1300),
}

_ENGINE = None
ROMAN_BOOKS = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
    "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11,
    "XII": 12, "XIII": 13,
}
BOOK_ROMANS = {number: roman for roman, number in ROMAN_BOOKS.items()}
ROMAN_DIGITS = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def roman_to_int(value: str) -> int:
    total = 0
    previous = 0
    for character in reversed(value.upper()):
        current = ROMAN_DIGITS.get(character, 0)
        total += -current if current < previous else current
        previous = max(previous, current)
    return total


def load_confessions_structure() -> dict[int, dict[int, set[int]]]:
    structure: dict[int, dict[int, set[int]]] = {}
    content_dir = ROOT / "src" / "content" / "tu-thuat"
    for book in range(1, 14):
        chapters: dict[int, set[int]] = {}
        current_chapter: int | None = None
        source = (content_dir / f"quyen-{book}.md").read_text(encoding="utf-8")
        for line in source.splitlines():
            heading = re.match(r"^####\s+\S+\s+([IVXLCDM]+)", line, re.I)
            if heading:
                current_chapter = roman_to_int(heading.group(1))
                chapters.setdefault(current_chapter, set())
                continue
            paragraph = re.match(r"^(\d+)\s+", line)
            if current_chapter and paragraph:
                chapters[current_chapter].add(int(paragraph.group(1)))
        structure[book] = chapters
    return structure


CONFESSIONS_STRUCTURE = load_confessions_structure()


def render_pages() -> None:
    PAGE_DIR.mkdir(parents=True, exist_ok=True)
    missing = [page for page in range(PAGE_FIRST, PAGE_LAST + 1)
               if not (PAGE_DIR / f"page-{page:02d}.png").exists()]
    if not missing:
        return
    if not PDFTOPPM:
        raise RuntimeError("Không tìm thấy pdftoppm trong PATH")
    subprocess.run([
        PDFTOPPM, "-f", str(PAGE_FIRST), "-l", str(PAGE_LAST), "-gray",
        "-png", "-r", str(SCALE_DPI), str(PDF), str(PAGE_DIR / "page"),
    ], check=True)


def load_cache() -> dict[str, list[dict]]:
    if not RAW_CACHE.exists():
        return {}
    payload = json.loads(RAW_CACHE.read_text(encoding="utf-8"))
    if payload.get("version") != OCR_VERSION:
        return {}
    return payload.get("pages", {})


def save_cache(cache: dict[str, list[dict]]) -> None:
    ordered = {key: cache[key] for key in sorted(cache, key=int)}
    payload = {"version": OCR_VERSION, "pages": ordered}
    RAW_CACHE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def worker_init() -> None:
    global _ENGINE
    # Delay this optional import until OCR is actually required. Rebuilding the
    # hierarchy from the completed raw cache must not need the OCR runtime.
    from rapidocr_onnxruntime import RapidOCR
    _ENGINE = RapidOCR(use_det=False, use_cls=False)


def line_boxes(column: np.ndarray) -> list[tuple[int, int, int, int]]:
    _, inverted = cv2.threshold(column, THRESHOLD_SEGMENT, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 3))
    joined = cv2.morphologyEx(inverted, cv2.MORPH_CLOSE, kernel)
    fragments: list[tuple[int, int, int, int]] = []
    contours = cv2.findContours(joined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        if 35 <= height <= 115 and width >= 80:
            fragments.append((x, y, width, height))

    groups: list[list[tuple[int, int, int, int]]] = []
    for box in sorted(fragments, key=lambda item: item[1] + item[3] / 2):
        center = box[1] + box[3] / 2
        if not groups:
            groups.append([box])
            continue
        prior_center = sum(item[1] + item[3] / 2 for item in groups[-1]) / len(groups[-1])
        if abs(center - prior_center) <= 25:
            groups[-1].append(box)
        else:
            groups.append([box])

    boxes: list[tuple[int, int, int, int]] = []
    for group in groups:
        x = min(item[0] for item in group)
        y = min(item[1] for item in group)
        x2 = max(item[0] + item[2] for item in group)
        y2 = max(item[1] + item[3] for item in group)
        if x2 - x >= 100:
            boxes.append((x, y, x2, y2))
    return boxes


def ocr_page(page: int, top_only: bool = False) -> tuple[int, list[dict]]:
    global _ENGINE
    if _ENGINE is None:
        worker_init()
    image = cv2.imread(str(PAGE_DIR / f"page-{page:02d}.png"), cv2.IMREAD_GRAYSCALE)
    if image is None:
        raise RuntimeError(f"Cannot read rendered page {page}")

    # Boundary 2150 is the gutter between the two printed index columns.
    columns = (("left", 650, 2150), ("right", 2150, 4350))
    # The printed index starts near y=920 on ordinary pages.  The old y=1300
    # crop silently discarded the first four or five lines of *both* columns,
    # merging page-opening headwords (for example ``chastity``) into the
    # preceding entry.  Start above the first baseline.  When a complete
    # legacy extraction is available, OCR only the missing top strip and reuse
    # its already-reviewed lower lines.
    y0, y1 = (850, 1375) if top_only else (850, 5650)
    output: list[dict] = []
    for column_name, x0, x1 in columns:
        column = image[y0:y1, x0:x1]
        boxes = line_boxes(column)
        crops: list[np.ndarray] = []
        metadata: list[tuple[int, int]] = []
        for x, y, x2, y2 in boxes:
            pad = 15
            crop = column[max(0, y - pad):min(column.shape[0], y2 + pad),
                          max(0, x - pad):min(column.shape[1], x2 + pad)]
            _, crop = cv2.threshold(crop, THRESHOLD_RECOGNITION, 255, cv2.THRESH_BINARY)
            crops.append(cv2.cvtColor(crop, cv2.COLOR_GRAY2BGR))
            metadata.append((x0 + x, y0 + y))

        if not crops:
            continue
        recognized, _ = _ENGINE.text_recognizer(crops)
        for (x, y), (text, confidence) in zip(metadata, recognized):
            if top_only and y >= 1300:
                continue
            normalized = clean_roman_noise(text)
            if normalized:
                output.append({
                    "page": page,
                    "column": column_name,
                    "x": x,
                    "y": y,
                    "text": normalized,
                    "confidence": float(confidence),
                })
    return page, output


def clean_roman_noise(text: str) -> str:
    source_text = re.sub(r"\s+", " ", text).strip()
    replacements = {
        "X1II": "XIII", "XI1I": "XIII", "X111": "XIII", "XIlI": "XIII",
        "XII1": "XIII", "XI11": "XIII", "X11": "XII",
        "V1II": "VIII", "VI1I": "VIII", "VII1": "VIII", "Vlll": "VIII",
        "VI1": "VII", "VIl": "VII", "VIf": "VII", "V1": "VI",
        "II1": "III", "I11": "III", "1I": "II",
        "Xlii": "XIII", "Xiii": "XIII", "Xii": "XII", "Xl": "XI",
        "Viii": "VIII", "Vii": "VII", "Vi": "VI", "Iv": "IV",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    # Frequent lowercase OCR confusions in ordinary index prose.
    text = re.sub(r"\bwili\b", "will", text, flags=re.I)
    text = re.sub(r"\biove\b", "love", text, flags=re.I)
    text = re.sub(r"\bunciean\b", "unclean", text, flags=re.I)
    text = re.sub(r"\buncieanness\b", "uncleanness", text, flags=re.I)
    # Ordinary-word OCR errors found while reviewing every generated headword.
    text = re.sub(r"\bspitefui\b", "spiteful", text, flags=re.I)
    text = re.sub(r"\bEiect\b", "Elect", text)
    text = re.sub(r"\bElijiah\b", "Elijah", text)
    text = re.sub(r"\bfree wil\b", "free will", text, flags=re.I)
    text = re.sub(r"\bhel1\b", "hell", text, flags=re.I)
    text = re.sub(r"\beternai\b", "eternal", text, flags=re.I)
    text = re.sub(r"\bVIrgin\b", "Virgin", text)
    text = re.sub(r"\bmetricai\b", "metrical", text, flags=re.I)
    text = re.sub(r"\bmateriai\b", "material", text, flags=re.I)
    text = re.sub(r"\bburiai\b", "burial", text, flags=re.I)
    text = re.sub(r"\brightfui\b", "rightful", text, flags=re.I)
    text = re.sub(r"\bdrawi\b", "drawl", text, flags=re.I)
    text = re.sub(r"\bife\b", "life", text, flags=re.I)
    text = re.sub(r"\bspacial\b", "spatial", text, flags=re.I)
    text = re.sub(r"\bfiesh\b", "flesh", text, flags=re.I)
    text = re.sub(r"\brecail\b", "recall", text, flags=re.I)
    text = re.sub(r"\bfirel\b", "fire!", text, flags=re.I)
    text = re.sub(r"\bali\b", "all", text)
    text = re.sub(r"\biower\b", "lower", text, flags=re.I)
    text = re.sub(r"\bweicoming\b", "welcoming", text, flags=re.I)
    text = re.sub(r"\bwhoiehearted\b", "wholehearted", text, flags=re.I)
    text = re.sub(r"\bXi(?=[,.])", "XI", text)
    text = re.sub(r"^ight(?=\s*,)", "light", text, flags=re.I)
    text = re.sub(r"\bskili\b", "skill", text, flags=re.I)
    text = re.sub(r"\bocation\b", "vocation", text, flags=re.I)
    text = re.sub(r"\bwil\b", "will", text, flags=re.I)
    text = re.sub(r"\bVIctorinus\b", "Victorinus", text)
    text = re.sub(r"\bVIctorious\b", "Victorious", text)
    text = re.sub(r"\bVIndicianus\b", "Vindicianus", text)
    text = re.sub(r"\bVIrgil\b", "Virgil", text)
    # ``p73``/``P53`` is a recurring scan artefact, not printed index content.
    text = re.sub(r"(?:^|\s)[pP]\d+\b", "", text).strip()
    text = re.sub(r"\bXI1(?=[,.])", "XIII", text)
    text = re.sub(r"\bVII1(?=[,.])", "VIII", text)
    text = re.sub(r"\bVI1(?=[,.])", "VII", text)
    text = re.sub(r"\bI1(?=[,.])", "II", text)
    text = re.sub(r"(?<![\d(])\b1(?=[,.]\s*\d)", "I", text)
    text = re.sub(r"\bX\s+III(?=[,.])", "XIII", text)
    text = re.sub(r"\s+", " ", text).strip()
    source_corrections = {
        # Verified directly against page 5 of the scanned source.
        "VII6(14). VII,7(16) p73": "VIII,6(14), VIII,7(16) p73",
        "sellall you possess ... VIII, 12(29)": "sell all you possess ... VIII,12(29)",
        # Visually verified against the remaining OCR audit lines.
        "physical bodies, XI1i,28(43)": "physical bodies, XIII,28(43)",
        "knowiledge, XII118(22)": "knowledge, XIII,18(22)",
        "day, Xi11,18(23), XII,19(25), XIII,24(35)": "day, XIII,18(23), XIII,19(25), XIII,24(35)",
        "despair, VI,1(i)": "despair, VI,1(1)",
        "formless matter, XII.3(3), i1.4(4).": "formless matter, XII,3(3), XII,4(4).",
        "rich young man .., Xi11,19(24)": "rich young man ..., XIII,19(24)",
        "form and, xil,6(6)": "form and, XII,6(6)",
        "time and, Xil,29(40)": "time and, XII,29(40)",
        "gift and, XIf'26(41), XIII,27(42)": "gift and, XIII,26(41), XIII,27(42)",
        "xi1,12(13)": "XIII,12(13)",
        "God, xilI,31(46)": "God, XIII,31(46)",
        "filing heaven and earth. 1,2(2), 13(3)": "filling heaven and earth, I,2(2), I,3(3)",
        "friendship with, VIIL6(15)": "friendship with, VIII,6(15)",
        "law of, ever unchanged, II,7(i3)": "law of, ever unchanged, III,7(13)",
        "XI 1 1(13)": "XI,11(13)",
        "superlative attributes, IL4(4)": "superlative attributes, I,4(4)",
        "conflicting impulses, VIlf,10(24)": "conflicting impulses, VIII,10(24)",
        "XIf11(11)": "XIII,11(11)",
        "gravity, Xi11.9(10)": "gravity, XIII,9(10)",
        "VI,6(9), VI,11(20), VII,1(1,2,11),": "VI,6(9), VI,11(20), VII,1(1,2,11),",
        "XIil,34(49)": "XIII,34(49)",
        "grounds for. 117(12) p73": "grounds for, III,7(12) p73",
        "Xil,31 (42)": "XII,31(42)",
        "Godhead, XIII,1 1 (12)": "Godhead, XIII,11(12)",
        "justice, I1,4(9), 16(12), II,10(18).": "justice, II,4(9), II,6(12), II,10(18).",
        "pretension to. Xi11,21 (30)": "pretension to, XIII,21(30)",
        "enamored with idea of, II, 1(i)": "enamored with idea of, III,1(1)",
        "consoled by a vision, 11,11 (19)": "consoled by a vision, III,11(19)",
        "gifts supplying, Xil1,26(41)": "gifts supplying, XIII,26(41)",
        "gospel, XIi1,20(27)": "gospel, XIII,20(27)",
        "XIil,15(16)": "XIII,15(16)",
        "pleasure, 1.20(31), 12(4), IV,2(3).": "pleasure, I,20(31), II,2(4), IV,2(3).",
        "Monica's, for Augustine, II, 1 1(20),": "Monica's, for Augustine, III,11(20),",
        "sacraments, I 1 1 (17), XIII,34(49)": "sacraments, I,11(17), XIII,34(49)",
        "seeding. XIi1,25(38)": "seeding, XIII,25(38)",
        "Solomon, II,6(1 i)": "Solomon, III,6(11)",
        "skills of the tongue, I,9(i4)": "skills of the tongue, I,9(14)",
        "Spirit-filed persons, XI1i,23(33)": "Spirit-filled persons, XIII,23(33)",
        "creature of God, XI.14(i7)": "creature of God, XI,14(17)",
        "potential for change, XII, 1 5(21)": "potential for change, XII,15(21)",
        "successive periods of, xil.9(9)": "successive periods of, XII,9(9)",
        "entrusting truth to Truth, IV.11(i6)": "entrusting truth to Truth, IV,11(16)",
        "quest for, VI,11(i9)": "quest for, VI,11(19)",
        "II.11(19)-If,11(20)": "III,11(19)–III,11(20)",
        "welcoming, XIi1,26(41), XIII,27(42)": "welcoming, XIII,26(41), XIII,27(42)",
        "whales. XIII,20(26), XI127(42)": "whales, XIII,20(26), XIII,27(42)",
        "nally, XII, 1 5(18)": "finally, XII,15(18)",
        "creation, Xil,28(39)": "creation, XII,28(39)",
        "VII,13(i9)": "VII,13(19)",
        "II,14 (15), XIII,21 (30), XII23(34)": "III,14(15), XIII,21(30), XIII,23(34)",
        "XII.38(53)": "XIII,38(53)",
        "poor, XII.34(49)": "poor, XIII,34(49)",
        "heresy, II,i1(21), VII,19(25)": "heresy, III,11(21), VII,19(25)",
        "has made, XII,34(49)": "has made, XIII,34(49)",
        "rest in God's holiness, XII,38(53)": "rest in God's holiness, XIII,38(53)",
        "inteliect, XII,34(49)": "intellect, XIII,34(49)",
        "II,6(10)-I1,12(21)": "III,6(10)–III,12(21)",
        "maturity. XI,34(49)": "maturity, XIII,34(49)",
        "ministers, XII,21 (30), XI,34(49)": "ministers, XIII,21(30), XIII,34(49)",
        "II,11(21)": "III,11(21)",
        "mothers, II,11(19)": "mothers, III,11(19)",
        "I,19(30), II,11(21), IV,1(1),": "I,19(30), III,11(21), IV,1(1),",
        "II,11(19)": "III,11(19)",
        "providence, II.7(15), II14(8), II,11(19).": "providence, II,7(15), III,4(8), III,11(19).",
        "V,7(13), VI,3(3), VI.21(27).": "V,7(13), VI,3(3), VII,21(27).",
        "Sabbath, XII,36(50,51)": "Sabbath, XIII,36(50,51)",
        "prisoner of law of, VI,21 (27)": "prisoner of law of, VII,21(27)",
        "self-control, XII.34(49)": "self-control, XIII,34(49)",
        "Monica's prayer, II,11(21)": "Monica's prayer, III,11(21)",
        "unbelievers, XII,34 (49)": "unbelievers, XIII,34(49)",
        "XIII,36(51), XII,38(53)": "XIII,36(51), XIII,38(53)",
        "misfortune, II,8(16)": "Monica, II,8(16)",
        "misfortune, I1.8(16)": "Monica, II,8(16)",
        "Ward of God. V,3(5). VII,2(3), IX.10(25)": "Word of God, V,3(5), VII,2(3), IX,10(25)",
        "See aiso wild animals.": "See also wild beasts.",
        "See aiso body and soul.": "See also body and soul.",
        # Verified directly against PDF page 8.
        "please, not yet .... VI,7(17)": "please, not yet .... VIII,7(17)",
        # OCR confuses a closing square bracket with a lowercase l/j.
        "adoption [chidren of Godj, XI,2(4),": "adoption [children of God], XI,2(4),",
        "what I am now [as I writel, X,3(4),": "what I am now [as I write], X,3(4),",
        "God [singularl made man,": "God [singular] made man,",
        "perversity, II,6(14), 11.8(16)": "perversity, II,6(14), II,8(16)",
        # Citation-shape repairs verified against the scanned index pages.
        "sexual awakening, II,i(1)": "sexual awakening, II,1(1)",
        "Manichean fable, II,10(18), IV,i(1)": "Manichean fable, II,10(18), IV,1(1)",
        "atmosphere, VII,i (2)": "atmosphere, VII,1(2)",
        "Xil1,2(3)": "XIII,2(3)",
        "singing of hymns and psalms,JIX,7(15)": "singing of hymns and psalms, IX,7(15)",
        "pleasure. VIm1,3(7)": "pleasure, VIII,3(7)",
        "gift of being, XIII I(1)": "gift of being, XIII,1(1)",
        "loud and clear, XII,1i(1i)": "loud and clear, XII,11(11)",
        "anticipated; rewarded, XIII,I(1)": "anticipated; rewarded, XIII,1(1)",
        "punishment and, i11,3(5)": "punishment and, III,3(5)",
        "coeternal with the Father, VII,2i(27)": "coeternal with the Father, VII,21(27)",
        "XIII,ii (12)": "XIII,11(12)",
        "loving and being loved, II,i(1)": "loving and being loved, II,1(1)",
        "VI,11(19), VI,12(22), VII,i (2),": "VI,11(19), VI,12(22), VII,1(2),",
        "comes to Milan, VI,i(1)": "comes to Milan, VI,1(1)",
        "needs, X,3i (47), XI,2(2,4), XIII,21(29)": "needs, X,31(47), XI,2(2,4), XIII,21(29)",
        "philosophy. VI,12(21), VII,i (1)": "philosophy, VI,12(21), VII,1(1)",
        "sinners; joy, VIHI,3(6)": "sinners; joy, VIII,3(6)",
        "XII,II(11)": "XII,11(11)",
        "thirsting for God, XII,1i (13).": "thirsting for God, XII,11(13).",
        "spiritual direction, VII,i (1)": "spiritual direction, VII,1(1)",
        "material idea of, VII,i(1)": "material idea of, VII,1(1)",
        "extension\" of, XI,2i(27)": "extension\" of, XI,21(27)",
        "triad within ourselves, XIII,1 i (12)": "triad within ourselves, XIII,11(12)",
        "unity, XII,II(12), XIII,22(32)": "unity, XIII,11(12), XIII,22(32)",
        "XIII,i (12)": "XIII,11(12)",
        "reverence, VIi,i (2)": "reverence, VIII,1(2)",
        "fear of dying, IV,6(i1), VI,16(26).": "fear of dying, IV,6(11), VI,16(26).",
        "empowered by the soul, X,7(ii)": "empowered by the soul, X,7(11)",
        "freedom for humans, XI,1(i)": "freedom for humans, XI,1(1)",
        "XII,7() XII,13(16),": "XII,7(7), XII,13(16),",
        "VII,5()": "VII,5(7)",
        "woridliness. VI,10(17). VI,11(19),": "worldliness, VI,10(17), VI,11(19), X,",
        # Raw OCR variants before punctuation normalization.
        "Xil,31(42)": "XII,31(42)",
        "XII.7() XII,13(16),": "XII,7(7), XII,13(16),",
        "XII, 15(22), Xil1,2(3)": "XII,15(22), XIII,2(3)",
        "VII.5()": "VII,5(7)",
        "XII,1I(11)": "XII,11(11)",
        "unity, XII.1I(12), XII,22(32)": "unity, XIII,11(12), XIII,22(32)",
        "re. Antony of Egypt, VII,6(14-15),": "re. Antony of Egypt, VIII,6(14-15),",
    }
    text = source_corrections.get(source_text, text)
    # Some reviewed source corrections above predate removal of the recurring
    # watermark/page artefact, so apply the cleanup once more at the end.
    text = re.sub(r"(?:^|\s)[pP]\d+\b", "", text).strip()
    return text


ROMAN = r"(?:XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)"
ROMAN_REF = re.compile(rf"\b{ROMAN}[,.]\s*\d+(?:\s*\([\d,.\s\u2013\u2014-]+\))?", re.I)


def canonicalize_reference_structure(text: str) -> str:
    """Repair OCR citations that cannot exist in the translated Confessions.

    Paragraph numbers are continuous inside each book, so their chapter is
    deterministic.  Roman OCR most often drops one or two trailing ``I``
    characters (III -> II, VIII -> VI/VII, XIII -> XI/XII).  Prefer those
    source-shaped repairs, then repair a misread Arabic chapter digit only
    when the paragraph belongs to exactly one chapter in the stated book.
    Raw OCR remains available in the OCR cache; generated line text and links
    receive this validated form.
    """
    pattern = re.compile(
        rf"\b({ROMAN})[,.]\s*(\d+)\s*\(([\d,.\s]+)\)",
        re.I,
    )
    lost_trailing_i_candidates = {
        2: (3,),
        6: (7, 8),
        7: (8,),
        11: (12, 13),
        12: (13,),
    }

    def valid(book: int, chapter: int, paragraph: int) -> bool:
        return paragraph in CONFESSIONS_STRUCTURE.get(book, {}).get(chapter, set())

    def replace(match: re.Match[str]) -> str:
        roman = match.group(1).upper()
        book = ROMAN_BOOKS.get(roman)
        chapter = int(match.group(2))
        paragraph_match = re.search(r"\d+", match.group(3))
        if not book or not paragraph_match:
            return match.group(0)
        paragraph = int(paragraph_match.group(0))
        if valid(book, chapter, paragraph):
            return match.group(0)

        for candidate_book in lost_trailing_i_candidates.get(book, ()):
            if valid(candidate_book, chapter, paragraph):
                return f"{BOOK_ROMANS[candidate_book]},{chapter}({match.group(3).strip()})"

        candidate_chapters = [
            candidate_chapter
            for candidate_chapter, paragraphs in CONFESSIONS_STRUCTURE.get(book, {}).items()
            if paragraph in paragraphs
        ]
        if len(candidate_chapters) == 1:
            return f"{roman},{candidate_chapters[0]}({match.group(3).strip()})"
        return match.group(0)

    return pattern.sub(replace, text)


def normalize_reference_punctuation(text: str) -> str:
    text = clean_roman_noise(text)
    # OCR regularly reads the leading digit 1 of a chapter as i/l.
    text = re.sub(rf"\b({ROMAN})\s*([,.'])\s*[il](?=\d+\s*\()", r"\1,1", text, flags=re.I)
    text = re.sub(rf"\b({ROMAN})[,.']+\s*", r"\1,", text, flags=re.I)
    text = re.sub(rf"\b({ROMAN})[.]\s*(\d)", r"\1,\2", text, flags=re.I)
    text = re.sub(rf"\b({ROMAN})\s+(\d+\s*\()", r"\1,\2", text, flags=re.I)
    text = re.sub(rf"\b({ROMAN})(\d{{1,2}})(?=\s*\()", r"\1,\2", text, flags=re.I)
    # A duplicated OCR '1' can turn chapter 11/18/21 into 111/118/121.
    text = re.sub(
        rf"\b({ROMAN}),1(\d{{2}})(?=\s*\()",
        lambda match: f"{match.group(1)},{match.group(2)}"
        if int(match.group(2)) <= 43 else match.group(0),
        text,
        flags=re.I,
    )
    text = re.sub(r"(\d)\s+\(", r"\1(", text)
    # OCR sometimes inserts a space inside a two-digit paragraph number,
    # e.g. ``(1 4,15)`` for ``(14,15)``.
    text = re.sub(r"\((\d)\s+(\d)(?=\s*[,.)])", r"(\1\2", text)
    text = re.sub(r",\s*(\d)\s+(\d)(?=\s*[,.)])", r",\1\2", text)
    text = re.sub(r"(?<=\d)[.](?=\d+(?:\D|$))", ",", text)
    # OCR often reads the digit 1 as i/I/l inside an otherwise numeric
    # chapter or paragraph. Restrict these repairs to citation-shaped spans.
    text = re.sub(
        rf"\b({ROMAN}),(\d*)[iIl](?=\s*\()",
        lambda match: f"{match.group(1)},{match.group(2)}1",
        text,
        flags=re.I,
    )
    text = re.sub(
        rf"(\b{ROMAN},\d+\s*\()([\d,iIl.\s\u2013\u2014-]+)(\))",
        lambda match: match.group(1)
        + match.group(2).translate(str.maketrans({"i": "1", "I": "1", "l": "1", "L": "1"}))
        + match.group(3),
        text,
        flags=re.I,
    )
    # The i/l-to-1 repair above can create a digit immediately before a
    # pre-existing space and parenthesis; normalize that final citation gap.
    text = re.sub(r"(\d)\s+\(", r"\1(", text)
    # Preserve the book/chapter/paragraph printed in the source.  Anchor
    # compatibility is an audit concern, never a basis for rewriting an index
    # citation: the transcription's chapter boundaries can themselves be
    # wrong, and OCR ambiguity such as ``II1`` must be checked against the
    # page image rather than coerced to whichever anchor exists.
    return text


def derive_headword(text: str) -> str:
    colon = text.find(":")
    ref = ROMAN_REF.search(text)
    stops = [value for value in (colon, ref.start() - 1 if ref else -1) if value >= 0]
    headword = text[:min(stops)] if stops else text
    return headword.strip(" ,;.-")


def is_content_line(line: dict) -> bool:
    """Exclude page furniture while retaining every printed index line."""
    page = int(line["page"])
    y = float(line["y"])
    text = line["text"].strip()
    if y < 850 or y > 5200:
        return False
    # Page 4 alone contains the index title and explanatory note above the text.
    if page == PAGE_FIRST and y < 1700:
        return False
    lowered = text.casefold()
    return not lowered.startswith((
        "volume ", "the confessions", "index ", "citations are ",
        "and paragraph", "prepared by",
    ))


def ordered_lines(cache: dict[str, list[dict]]) -> list[dict]:
    """Return the PDF reading order: page, full left column, full right column."""
    bases = {"left": 800, "right": 2150}
    output: list[dict] = []
    sequence = 0
    for page in range(PAGE_FIRST, PAGE_LAST + 1):
        for column in ("left", "right"):
            source_lines = sorted(
                (line for line in cache.get(str(page), [])
                 if line["column"] == column
                 and (page, column, round(float(line["y"]))) not in LINE_EXCLUSIONS
                 and is_content_line(line)),
                key=lambda line: line["y"],
            )
            for source in source_lines:
                sequence += 1
                indent = max(0, round(float(source["x"]) - bases[column]))
                level = 0 if indent < 60 else 1 if indent < 150 else 2
                raw_text = source["text"].strip()
                normalized = normalize_reference_punctuation(raw_text)
                if not normalized:
                    continue
                output.append({
                    "sequence": sequence,
                    "page": page,
                    "column": column,
                    "x": round(float(source["x"])),
                    "y": round(float(source["y"])),
                    "indent": indent,
                    "level": level,
                    "text": normalized,
                    "displayText": normalized,
                    "tabbedText": "\t" * level + normalized,
                    "references": [match.group(0).replace(".", ",")
                                   for match in ROMAN_REF.finditer(normalized)],
                    "confidence": round(float(source["confidence"]), 3),
                })
    return output


def load_legacy_lower_lines() -> dict[int, list[dict]]:
    """Reuse the complete, previously extracted lower portion of each page.

    Version 3 retained all content from y=1300 downward; only the top strip was
    cropped out.  Keeping those reviewed OCR lines avoids introducing a second
    recognition pass over roughly three thousand already-stable lines.
    """
    if not LINES_OUTPUT.exists():
        return {}
    try:
        payload = json.loads(LINES_OUTPUT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if int(payload.get("extractorVersion", 0)) >= STRUCTURE_VERSION:
        return {}

    grouped: dict[int, list[dict]] = {
        page: [] for page in range(PAGE_FIRST, PAGE_LAST + 1)
    }
    for line in payload.get("lines", []):
        page = int(line.get("page", 0))
        if page not in grouped or float(line.get("y", 0)) < 1300:
            continue
        grouped[page].append({
            "page": page,
            "column": line["column"],
            "x": line["x"],
            "y": line["y"],
            "text": line["text"],
            "confidence": line["confidence"],
        })
    if any(not grouped[page] for page in grouped):
        return {}
    return grouped


def looks_like_reference_continuation(text: str) -> bool:
    normalized = normalize_reference_punctuation(text)
    return bool(re.match(rf"^(?:{ROMAN})?\s*[,.;]?\s*\d", normalized, re.I))


def structure(lines: list[dict]) -> list[dict]:
    """Group ordered lines without changing text, order, or indentation."""
    entries: list[dict] = []
    current: dict | None = None
    active_subentry: dict | None = None
    for source_line in lines:
        line = source_line
        # A colon explicitly opens a subordinate list in the printed index.
        # Some of those child lines (notably under ``self:``) are marked with
        # a dash but sit too close to the column edge for geometry alone to
        # classify them as indented. Keep their source coordinates and promote
        # only their semantic level inside the hierarchy.
        if (current and current["hasExplicitChildren"]
                and line["level"] == 0
                and re.match(r"^[-–—]", line["text"])):
            line = {
                **line,
                "level": 1,
                "tabbedText": "\t" + line["text"],
                "semanticLevelFromColon": True,
            }
        if line["level"] == 0:
            if current:
                entries.append(current)
            normalized = normalize_reference_punctuation(line["text"])
            current = {
                "headword": derive_headword(normalized),
                "page": line["page"],
                "column": line["column"],
                # In the printed index, a trailing colon marks a main keyword
                # whose indented lines are subordinate keywords.
                "hasExplicitChildren": line["text"].rstrip().endswith(":"),
                "lines": [{**line, "kind": "main"}],
                "subentries": [],
                "directContinuations": [],
                "confidence": line["confidence"],
            }
            active_subentry = None
            continue

        if not current:
            # Defensive only: the first retained line in the source is a level-0
            # headword, but no extracted line should ever be discarded silently.
            current = {
                "headword": "[continuation]",
                "page": line["page"],
                "column": line["column"],
                "hasExplicitChildren": False,
                "lines": [], "subentries": [], "directContinuations": [],
                "confidence": line["confidence"],
            }

        is_subentry = line["level"] == 1 and not looks_like_reference_continuation(line["text"])
        kind = "subkeyword" if is_subentry else "continuation"
        structured_line = {**line, "kind": kind}
        current["lines"].append(structured_line)
        current["confidence"] = min(current["confidence"], line["confidence"])

        if is_subentry:
            active_subentry = {"text": line["text"], "lines": [structured_line]}
            current["subentries"].append(active_subentry)
        elif active_subentry:
            active_subentry["lines"].append(structured_line)
        else:
            current["directContinuations"].append(structured_line)
    if current:
        entries.append(current)

    for index, entry in enumerate(entries, 1):
        # A small number of long main terms wrap before their closing
        # parenthesis. Keep the printed line hierarchy, but expose a complete
        # headword for searching and navigation.
        if entry["headword"].count("(") > entry["headword"].count(")"):
            headword_source = entry["lines"][0]["displayText"]
            for continuation in entry["lines"][1:]:
                headword_source += " " + continuation["displayText"]
                if headword_source.count("(") <= headword_source.count(")"):
                    break
            entry["headword"] = derive_headword(headword_source)
        entry["id"] = f"kw-{index:04d}"
        entry["order"] = index
        entry["text"] = "\n".join(line["tabbedText"] for line in entry["lines"])
        entry["references"] = [reference for line in entry["lines"] for reference in line["references"]]
        entry["subentryCount"] = len(entry["subentries"])
        entry["confidence"] = round(float(entry["confidence"]), 3)
    return entries


def main() -> None:
    raise RuntimeError(
        "This legacy extractor is retained only for shared hierarchy helpers. "
        "Run scripts/reocr-confessions-index.py so printed citations are not "
        "rewritten from the site's anchor structure."
    )
    render_pages()
    legacy_lower_lines = load_legacy_lower_lines()
    top_only = bool(legacy_lower_lines)
    cache = load_cache()
    missing = [page for page in range(PAGE_FIRST, PAGE_LAST + 1) if str(page) not in cache]
    if missing:
        with ProcessPoolExecutor(max_workers=WORKERS, initializer=worker_init) as executor:
            futures = {
                executor.submit(ocr_page, page, top_only): page
                for page in missing
            }
            for future in as_completed(futures):
                page, lines = future.result()
                if top_only:
                    lines.extend(legacy_lower_lines[page])
                    lines.sort(key=lambda line: (
                        0 if line["column"] == "left" else 1,
                        float(line["y"]),
                    ))
                cache[str(page)] = lines
                save_cache(cache)
                print(f"OCR page {page}/{PAGE_LAST}: {len(lines)} lines", flush=True)

    lines = ordered_lines(cache)
    entries = structure(lines)
    lines_payload = {
        "extractorVersion": STRUCTURE_VERSION,
        "source": "temp_/index Conf..pdf",
        "readingOrder": "page -> left column top-to-bottom -> right column top-to-bottom",
        "lineCount": len(lines),
        "lines": lines,
    }
    LINES_OUTPUT.write_text(json.dumps(lines_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
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
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    low_confidence = sum(1 for entry in entries if entry["confidence"] < 0.75)
    structured_line_count = sum(len(entry["lines"]) for entry in entries)
    if structured_line_count != len(lines):
        raise RuntimeError(f"Lost lines while structuring: {structured_line_count}/{len(lines)}")
    print(f"Wrote {len(lines)} ordered lines and {len(entries)} main keyword entries "
          f"({low_confidence} low-confidence) to {OUTPUT}")


if __name__ == "__main__":
    main()
