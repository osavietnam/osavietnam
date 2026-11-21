"""Run an independent Tesseract pass over the cleaned Confessions index.

The TSV cache is diagnostic evidence from the page image.  It is not allowed
to consult or rewrite from the Vietnamese transcription's anchor structure.
"""

from __future__ import annotations

import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE_DIR = ROOT / "temp_" / "confessions-index-clean-pages"
OUTPUT_DIR = ROOT / "temp_" / "confessions-tesseract-tsv"
TESSERACT = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
PAGE_FIRST = 4
PAGE_LAST = 37
WORKERS = 4


def ocr_page(page: int) -> tuple[int, str]:
    source = PAGE_DIR / f"page-{page:02d}.png"
    result = subprocess.run(
        [
            str(TESSERACT),
            str(source),
            "stdout",
            "-l",
            "eng",
            "--psm",
            "4",
            "tsv",
        ],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return page, result.stdout


def main() -> None:
    if not TESSERACT.exists():
        raise FileNotFoundError(TESSERACT)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [
        page for page in range(PAGE_FIRST, PAGE_LAST + 1)
        if not (OUTPUT_DIR / f"page-{page:02d}.tsv").exists()
    ]
    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(ocr_page, page): page for page in missing}
        for future in as_completed(futures):
            page, text = future.result()
            target = OUTPUT_DIR / f"page-{page:02d}.tsv"
            target.write_text(text, encoding="utf-8")
            print(f"Tesseract page {page}/{PAGE_LAST}", flush=True)
    print(f"Tesseract TSV pages: {len(list(OUTPUT_DIR.glob('page-*.tsv')))}")


if __name__ == "__main__":
    main()
