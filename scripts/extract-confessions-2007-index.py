"""Build both Confessions indexes from the selected New City Press PDF.

Source of truth:
  temp_/2007. The Confessions - trans. Maria Boulding, O.S.B. 2007,
  New City Press).pdf

The PDF contains a usable text layer.  This extractor reads only:
  - PDF pages 319-323: Index of Scripture (Michael Dolan)
  - PDF pages 324-379: Index (Joseph Sprung)

No citation is inferred from, or rewritten to fit, site anchors.
"""

from __future__ import annotations

import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "temp_" / (
    "2007. The Confessions - trans. Maria Boulding, O.S.B. 2007, "
    "New City Press).pdf"
)
LAYOUT_TEXT = ROOT / "temp_" / "confessions-2007-layout.txt"
KEYWORD_BBOX = ROOT / "temp_" / "confessions-2007-keyword-bbox.html"
PDFTOTEXT = Path(
    r"C:\Users\jayce\AppData\Local\Programs\MiKTeX\miktex\bin\x64"
    r"\pdftotext.exe"
)

KEYWORD_OUTPUT = ROOT / "src" / "data" / "confessions-keyword-index.json"
KEYWORD_LINES_OUTPUT = ROOT / "src" / "data" / "confessions-keyword-lines.json"
SCRIPTURE_OUTPUT = ROOT / "src" / "data" / "confessions-scripture-index.ts"

SCRIPTURE_FIRST = 319
SCRIPTURE_LAST = 323
KEYWORD_FIRST = 324
KEYWORD_LAST = 379

ROMAN = r"(?:XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)"
KEYWORD_REFERENCE = re.compile(
    rf"(?<![A-Za-z]){ROMAN}\s*[,.:]\s*\d+"
    r"(?:\s*\([\d,.\s–—-]+\))?",
    re.I,
)

BOOKS = {
    "Genesis": ("Cựu Ước", "Sáng Thế", "St"),
    "Exodus": ("Cựu Ước", "Xuất Hành", "Xh"),
    "Job": ("Cựu Ước", "Gióp", "G"),
    "Psalms": ("Cựu Ước", "Thánh Vịnh", "Tv"),
    "Proverbs": ("Cựu Ước", "Châm Ngôn", "Cn"),
    "Wisdom": ("Cựu Ước", "Khôn Ngoan", "Kn"),
    "Sirach": ("Cựu Ước", "Huấn Ca", "Hc"),
    "Isaiah": ("Cựu Ước", "Isaia", "Is"),
    "Jeremiah": ("Cựu Ước", "Giêrêmia", "Gr"),
    "Matthew": ("Tân Ước", "Mátthêu", "Mt"),
    "Luke": ("Tân Ước", "Luca", "Lc"),
    "John": ("Tân Ước", "Gioan", "Ga"),
    "Acts of the Apostles": ("Tân Ước", "Công Vụ Tông Đồ", "Cv"),
    "Romans": ("Tân Ước", "Rôma", "Rm"),
    "1 Corinthians": ("Tân Ước", "1 Côrintô", "1 Cr"),
    "2 Corinthians": ("Tân Ước", "2 Côrintô", "2 Cr"),
    "Galatians": ("Tân Ước", "Galát", "Gl"),
    "Ephesians": ("Tân Ước", "Êphêsô", "Ep"),
    "Philippians": ("Tân Ước", "Philípphê", "Pl"),
    "Colossians": ("Tân Ước", "Côlôxê", "Cl"),
    "1 Timothy": ("Tân Ước", "1 Timôthê", "1 Tm"),
    "2 Timothy": ("Tân Ước", "2 Timôthê", "2 Tm"),
    "Titus": ("Tân Ước", "Titô", "Tt"),
    "Hebrews": ("Tân Ước", "Do Thái", "Dt"),
    "James": ("Tân Ước", "Giacôbê", "Gc"),
    "1 Peter": ("Tân Ước", "1 Phêrô", "1 Pr"),
    "1 John": ("Tân Ước", "1 Gioan", "1 Ga"),
    "Revelation": ("Tân Ước", "Khải Huyền", "Kh"),
}


def extract_layout() -> list[str]:
    if not PDF.exists():
        raise FileNotFoundError(PDF)
    if not PDFTOTEXT.exists():
        raise FileNotFoundError(PDFTOTEXT)
    subprocess.run(
        [str(PDFTOTEXT), "-layout", str(PDF), str(LAYOUT_TEXT)],
        check=True,
        capture_output=True,
    )
    text = LAYOUT_TEXT.read_text(encoding="utf-8", errors="replace")
    pages = text.split("\f")
    if len(pages) < KEYWORD_LAST:
        raise RuntimeError(f"Expected at least {KEYWORD_LAST} pages, got {len(pages)}")
    return pages


def clean_text(text: str) -> str:
    replacements = {
        "â€™": "’",
        "â€œ": "“",
        "â€": "”",
        "â€¦": "…",
        "â€“": "–",
        "â€”": "—",
        "\u00a0": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    # Recurring scan/text-layer artifacts, not printed index content.  They
    # sometimes attach directly to the preceding citation.
    text = re.sub(r"(?i)\s*(?:p73|p53)\b", "", text)
    text = re.sub(r"\bX\s+III(?=\s*[,.:]\s*\d)", "XIII", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Corrections verified against the numbered paragraphs in the body of
    # this same PDF, rather than inferred from the Vietnamese site anchors.
    verified_keyword_corrections = {
        "I,9(11)": "XI,9(11)",
        "II,6(11)": "III,6(11)",
        "II,6(10,11)": "II,5(10,11)",
        "III,11(21)": "III,12(21)",
        "XI,22(31)": "XII,22(31)",
        "XIII,36(50,51)": "XIII,35(50), XIII,36(51)",
    }
    for printed, verified in verified_keyword_corrections.items():
        text = text.replace(printed, verified)

    # Standardize only typography inside intact printed citations.
    def normalize_reference(match: re.Match[str]) -> str:
        value = match.group(0)
        value = re.sub(r"\s+", "", value)
        value = re.sub(r"^([IVX]+)[.:]", r"\1,", value, flags=re.I)
        roman = re.match(r"^[IVX]+", value, re.I)
        if roman:
            value = roman.group(0).upper() + value[roman.end():]
        return value

    return KEYWORD_REFERENCE.sub(normalize_reference, text)


def keyword_source_lines(pages: list[str]) -> list[dict]:
    subprocess.run(
        [
            str(PDFTOTEXT),
            "-f",
            str(KEYWORD_FIRST),
            "-l",
            str(KEYWORD_LAST),
            "-bbox-layout",
            str(PDF),
            str(KEYWORD_BBOX),
        ],
        check=True,
        capture_output=True,
    )
    root = ET.parse(KEYWORD_BBOX).getroot()
    namespace = {"x": "http://www.w3.org/1999/xhtml"}
    bbox_pages = root.findall(".//x:page", namespace)
    expected_pages = KEYWORD_LAST - KEYWORD_FIRST + 1
    if len(bbox_pages) != expected_pages:
        raise RuntimeError(
            f"Expected {expected_pages} keyword bbox pages, got {len(bbox_pages)}"
        )

    output = []
    sequence = 0
    for page_offset, page in enumerate(bbox_pages):
        page_number = KEYWORD_FIRST + page_offset
        started = page_number != KEYWORD_FIRST
        for line in page.findall(".//x:line", namespace):
            words = [
                word.text or ""
                for word in line.findall("x:word", namespace)
                if (word.text or "").strip()
            ]
            if not words:
                continue
            raw = " ".join(words)
            if not started:
                if raw.startswith("Abraham,"):
                    started = True
                else:
                    continue
            x_min = float(line.attrib["xMin"])
            y_min = float(line.attrib["yMin"])
            text = clean_text(raw)
            if not text:
                continue
            # The printed hierarchy is encoded in the PDF coordinates even
            # when pdftotext's plain layout loses indentation at page breaks.
            # A few wrapped lines have inherited the left margin; their content
            # and exact page context retain the printed level.
            citation_continuation = bool(re.match(
                rf"^(?:{ROMAN})\s*[,.:]\s*\d",
                text,
                re.I,
            ))
            known_subentries = {
                (348, "sense-impressions; memory, X,8(13,14)"),
                (349, "infants, I,7(11)"),
                (351, "zeal for, X,35(54)"),
            }
            if citation_continuation:
                level = 2
            elif text.startswith(("-", "–", "—")):
                level = 1
            elif (page_number, text) in known_subentries:
                level = 1
            elif x_min < 50:
                level = 0
            elif x_min < 68:
                level = 1
            else:
                level = 2
            indent = max(0, round(x_min - 45))
            # The typeset index occasionally places two short logical entries
            # on one physical line.  Split those printed run-ins explicitly.
            run_ins = {
                (330, "spiritual, XIII,18(22) choice:"): [
                    ("spiritual, XIII,18(22)", 1),
                    ("choice:", 0),
                ],
                (335, "day, XIII,18(23), XIII,19(25), XIII,24(35) constitution of: time or movement, XI,23(30)"): [
                    ("day, XIII,18(23), XIII,19(25), XIII,24(35)", 0),
                    ("constitution of: time or movement, XI,23(30)", 1),
                ],
                (337, "fed by widow, XIII,26(41) meat, X,31(46)"): [
                    ("fed by widow, XIII,26(41)", 1),
                    ("meat, X,31(46)", 1),
                ],
                (337, "error, I,16(26), IV,15(26), XII,32(43) memory, X,13(20)"): [
                    ("error, I,16(26), IV,15(26), XII,32(43)", 0),
                    ("memory, X,13(20)", 1),
                ],
                (337, "evil, See good and evil. Evodius, IX,8(17), IX,12(31)"): [
                    ("evil, See good and evil.", 0),
                    ("Evodius, IX,8(17), IX,12(31)", 0),
                ],
                (348, "God in the heart, XI,31(41) hunger:"): [
                    ("God in the heart, XI,31(41)", 1),
                    ("hunger:", 0),
                ],
                (348, "In the Beginning … See creation. Incarnation:"): [
                    ("In the Beginning … See creation.", 0),
                    ("Incarnation:", 0),
                ],
                (358, "mutability, See change. mystical experience:"): [
                    ("mutability, See change.", 0),
                    ("mystical experience:", 0),
                ],
                (362, "public shows, See shows. punishment, I,9(15), I,14(23), VI,11(19), VIII,9(21), VIII,10(22)"): [
                    ("public shows, See shows.", 0),
                    ("punishment, I,9(15), I,14(23), VI,11(19), VIII,9(21), VIII,10(22)", 0),
                ],
                (363, "recall, See memory. reconciliation:"): [
                    ("recall, See memory.", 0),
                    ("reconciliation:", 0),
                ],
                (368, "See also body and soul. clinging to created things, IV,10(15)"): [
                    ("See also body and soul.", 1),
                    ("clinging to created things, IV,10(15)", 1),
                ],
                (371, "theft, See stealing. Thessalonica, XIII,26(40)"): [
                    ("theft, See stealing.", 0),
                    ("Thessalonica, XIII,26(40)", 0),
                ],
                (373, "tongue, See speaking; speech. tongues, XIII,18(23), XIII,24(36)"): [
                    ("tongue, See speaking; speech.", 0),
                    ("tongues, XIII,18(23), XIII,24(36)", 0),
                ],
                (378, "pleasure in, II,6(14), II,8(16) “wreckers” (students), III,3(6)"): [
                    ("pleasure in, II,6(14), II,8(16)", 1),
                    ("“wreckers” (students), III,3(6)", 0),
                ],
            }
            logical_lines = run_ins.get((page_number, text), [(text, level)])
            for logical_text, logical_level in logical_lines:
                sequence += 1
                refs = [
                    re.sub(r"\s+", "", match.group(0)).replace(".", ",", 1)
                    for match in KEYWORD_REFERENCE.finditer(logical_text)
                ]
                output.append({
                    "sequence": sequence,
                    "page": page_number,
                    "column": "single",
                    "x": round(x_min, 3),
                    "y": round(y_min, 3),
                    "indent": indent,
                    "level": logical_level,
                    "text": logical_text,
                    "displayText": logical_text,
                    "tabbedText": "\t" * logical_level + logical_text,
                    "references": refs,
                    "confidence": 1.0,
                    "source": "pdf-text-layer",
                })
    return output


def derive_headword(text: str) -> str:
    colon = text.find(":")
    ref = KEYWORD_REFERENCE.search(text)
    stops = [
        value for value in (colon, ref.start() - 1 if ref else -1)
        if value >= 0
    ]
    return text[:min(stops) if stops else None].strip(" ,;.-")


def structure_keywords(lines: list[dict]) -> list[dict]:
    entries = []
    current = None
    active_subentry = None
    for source in lines:
        line = dict(source)
        if line["level"] == 0:
            if current:
                entries.append(current)
            current = {
                "headword": derive_headword(line["text"]),
                "page": line["page"],
                "column": "left",
                "hasExplicitChildren": line["text"].rstrip().endswith(":"),
                "lines": [{**line, "kind": "main"}],
                "subentries": [],
                "directContinuations": [],
                "confidence": 1.0,
            }
            active_subentry = None
            continue
        if current is None:
            raise RuntimeError(f"Continuation before main entry: {line}")

        is_reference_continuation = bool(re.match(
            rf"^(?:{ROMAN})\s*[,.:]\s*\d",
            line["text"],
            re.I,
        ))
        is_subentry = line["level"] == 1 and not is_reference_continuation
        structured = {
            **line,
            "kind": "subkeyword" if is_subentry else "continuation",
        }
        current["lines"].append(structured)
        if is_subentry:
            active_subentry = {"text": line["text"], "lines": [structured]}
            current["subentries"].append(active_subentry)
        elif active_subentry is not None:
            active_subentry["lines"].append(structured)
        else:
            current["directContinuations"].append(structured)
    if current:
        entries.append(current)

    for order, entry in enumerate(entries, 1):
        entry["id"] = f"kw-{order:04d}"
        entry["order"] = order
        entry["text"] = "\n".join(line["tabbedText"] for line in entry["lines"])
        entry["references"] = [
            reference
            for line in entry["lines"]
            for reference in line["references"]
        ]
        entry["subentryCount"] = len(entry["subentries"])
    return entries


def normalize_bible_reference(value: str) -> str:
    value = re.sub(r"\s+", "", value)

    def normalize_group(match: re.Match[str]) -> str:
        text = match.group(0)
        if ":" not in text:
            return text
        chapter, verses = text.split(":", 1)
        return chapter + "," + verses.replace(",", ".")

    value = re.sub(r"\d+(?:\(\d+\))?:[\d,.\-]+", normalize_group, value)
    value = re.sub(
        r"\((\d+):([\d,.\-]+)\)",
        lambda match: (
            f"({match.group(1)},{match.group(2).replace(',', '.')})"
        ),
        value,
    )
    return value


def normalize_confessions_scripture(value: str) -> list[str]:
    refs = []
    for part in value.split(";"):
        match = re.search(
            rf"({ROMAN})\s*,\s*(\d+)\s*,\s*(\d+)",
            part,
            re.I,
        )
        if match:
            refs.append(
                f"{match.group(1).upper()},{match.group(2)},{match.group(3)}"
            )
    return refs


def scripture_books(pages: list[str]) -> list[dict]:
    entries_by_book: dict[str, list[list[object]]] = {
        book: [] for book in BOOKS
    }
    current_book = None
    row_pattern = re.compile(r"^\s*(\d[\d():.,\-\s]*)\s{2,}(.+?)\s*$")
    heading_aliases = {
        # Typo present in the PDF text layer.
        "2 Corinithians": "2 Corinthians",
    }

    def verified_scripture_refs(
        book: str,
        bible: str,
        confessions: list[str],
    ) -> list[str]:
        # Located from the English quotation and its numbered footnote in the
        # body of this edition.
        corrections = {
            ("Hebrews", "5,5"): ["XI,13,16"],
            ("Sirach", "39,21"): ["VII,12,18"],
            ("Sirach", "3,19(17)"): ["XIII,21,31"],
        }
        return corrections.get((book, bible), confessions)
    for page_number in range(SCRIPTURE_FIRST, SCRIPTURE_LAST + 1):
        for raw in pages[page_number - 1].splitlines():
            stripped = raw.strip()
            if not stripped:
                continue
            stripped = heading_aliases.get(stripped, stripped)
            if stripped in BOOKS:
                current_book = stripped
                continue
            if (
                stripped in {"Old Testament", "New Testament"}
                or "Index of Scrip" in stripped
                or stripped.startswith("(prepared by")
            ):
                continue

            # A handful of rows have no separating whitespace in the PDF text
            # layer, so the final character of the Bible reference and/or the
            # first Roman character of the Confessions citation is attached.
            # These repairs split the printed columns; they do not infer from
            # site anchors.
            compact = re.sub(r"\s+", "", stripped)
            merged_rows = {
                "100(101):1IX,12,31": ("100(101):1", "IX,12,31"),
                "18:30X,31,45": ("18:30", "X,31,45"),
                "6:3XII,7,7": ("6:3", "XII,7,7"),
                "1:9IV,15,25": ("1:9", "IV,15,25"),
                "5:8VIII,10,22": ("5:8", "VIII,10,22"),
                "5:14VIII,5,12": ("5:14", "VIII,5,12"),
            }
            if compact in merged_rows:
                if current_book is None:
                    raise RuntimeError(
                        f"Merged row before book p{page_number}: {raw!r}"
                    )
                bible_raw, confessions_raw = merged_rows[compact]
                bible = normalize_bible_reference(bible_raw)
                confessions = normalize_confessions_scripture(confessions_raw)
                entries_by_book[current_book].append([
                    bible,
                    verified_scripture_refs(
                        current_book,
                        bible,
                        confessions,
                    ),
                ])
                continue

            match = row_pattern.match(raw)
            if not match or current_book is None:
                continue
            bible = normalize_bible_reference(match.group(1).strip())
            confessions = normalize_confessions_scripture(match.group(2))
            if not confessions:
                raise RuntimeError(
                    f"Unparsed Scripture row p{page_number}: {raw!r}"
                )
            entries_by_book[current_book].append([
                bible,
                verified_scripture_refs(
                    current_book,
                    bible,
                    confessions,
                ),
            ])

    result = []
    for book_en, (testament, book_vi, abbreviation) in BOOKS.items():
        result.append({
            "testament": testament,
            "book": book_vi,
            "bookEn": book_en,
            "abbreviation": abbreviation,
            "entries": entries_by_book[book_en],
        })
    count = sum(len(book["entries"]) for book in result)
    if count != 132:
        counts = {
            book["bookEn"]: len(book["entries"])
            for book in result
        }
        raise RuntimeError(
            f"Expected 132 Scripture rows, extracted {count}: {counts}"
        )
    return result


def write_keyword_data(lines: list[dict], entries: list[dict]) -> None:
    source_name = PDF.name
    KEYWORD_LINES_OUTPUT.write_text(
        json.dumps({
            "extractorVersion": 11,
            "source": f"temp_/{source_name}",
            "sourcePages": [KEYWORD_FIRST, KEYWORD_LAST],
            "readingOrder": "PDF page -> text-layer line top-to-bottom",
            "lineCount": len(lines),
            "lines": lines,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    KEYWORD_OUTPUT.write_text(
        json.dumps({
            "extractorVersion": 11,
            "source": f"temp_/{source_name}",
            "sourcePages": [KEYWORD_FIRST, KEYWORD_LAST],
            "preparedBy": "Joseph Sprung",
            "work": "Tự Thuật",
            "workEn": "The Confessions",
            "indexType": "keyword",
            "entryCount": len(entries),
            "lineCount": len(lines),
            "entries": entries,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def ts_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_scripture_data(books: list[dict]) -> None:
    lines = [
        "export type ScriptureBook = {",
        "  testament: 'Cựu Ước' | 'Tân Ước';",
        "  book: string;",
        "  bookEn: string;",
        "  abbreviation: string;",
        "  entries: Array<[reference: string, confessions: string[]]>;",
        "};",
        "",
        "/**",
        " * Index of Scripture, The Confessions, Works of Saint Augustine I/1.",
        " * Extracted directly from PDF pages 319-323; prepared by Michael Dolan.",
        " */",
        "const scriptureIndex: ScriptureBook[] = [",
    ]
    for book in books:
        lines.extend([
            "  {",
            f"    testament: {ts_string(book['testament'])},",
            f"    book: {ts_string(book['book'])},",
            f"    bookEn: {ts_string(book['bookEn'])},",
            f"    abbreviation: {ts_string(book['abbreviation'])},",
            "    entries: [",
        ])
        for bible, confessions in book["entries"]:
            refs = ", ".join(ts_string(value) for value in confessions)
            lines.append(f"      [{ts_string(bible)}, [{refs}]],")
        lines.extend(["    ],", "  },"])
    lines.extend(["];", "", "export default scriptureIndex;", ""])
    SCRIPTURE_OUTPUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    pages = extract_layout()
    lines = keyword_source_lines(pages)
    entries = structure_keywords(lines)
    books = scripture_books(pages)
    write_keyword_data(lines, entries)
    write_scripture_data(books)
    print(
        f"Wrote {len(lines)} keyword lines / {len(entries)} entries; "
        f"{sum(len(book['entries']) for book in books)} Scripture rows"
    )


if __name__ == "__main__":
    main()
