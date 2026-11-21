"""
Sinh lịch phụng vụ cho năm 2020-2100 và lưu vào
public/data/calendar/{year}.json   (mỗi file = 1 năm phụng vụ)

Format output mỗi file:
{
  "year": 2026,
  "cycle": "A",
  "days": {
    "2025-11-30": { "s": "mua-vong", "l": "Chúa Nhật 1 Mùa Vọng" },
    ...
  }
}
"""

import json, sys, os
from pathlib import Path

# Import hàm từ gen_calendar.py cùng thư mục
sys.path.insert(0, os.path.dirname(__file__))
from gen_calendar import generate_liturgical_year

OUT_DIR = Path(__file__).parent.parent / "public" / "data" / "calendar"
START_YEAR = 2020
END_YEAR   = 2100

CYCLE_MAP = {0: 'A', 1: 'B', 2: 'C'}

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total_days = 0
    for year in range(START_YEAR, END_YEAR + 1):
        start_year   = year - 1
        cycle_letter = CYCLE_MAP[start_year % 3]
        suffix       = f", Năm {cycle_letter}"

        raw = generate_liturgical_year(year)

        days = {}
        for season, entries in raw.items():
            for e in entries:
                if "date" not in e or "liturgy" not in e:
                    continue
                lit = e["liturgy"]
                if lit.endswith(suffix):
                    lit = lit[: -len(suffix)]
                days[e["date"]] = {"s": season, "l": lit}

        out = {"year": year, "cycle": cycle_letter, "days": days}
        path = OUT_DIR / f"{year}.json"
        path.write_text(
            json.dumps(out, ensure_ascii=False, separators=(',', ':')),
            encoding="utf-8"
        )
        total_days += len(days)
        print(f"  {year} ({cycle_letter}) - {len(days)} ngay -> {path.name}")

    print(f"\nDone: {END_YEAR - START_YEAR + 1} files, {total_days} days total.")

if __name__ == "__main__":
    main()
