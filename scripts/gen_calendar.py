import json
import argparse
import re
from datetime import date, timedelta

# ==============================================================================
# Helper Functions
# ==============================================================================

def slugify(text):
    """
    Converts a string into a URL-friendly/filename-friendly slug.
    Example: "Chúa Nhật 3, Mùa Vọng" -> "chua-nhat-3-mua-vong"
    """
    text = text.lower()
    # Basic replacement for Vietnamese diacritics
    replacements = {
        'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'ă': 'a', 'ắ': 'a', 'ằ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a', 'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'đ': 'd', 'é': 'e', 'è': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e', 'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i', 'ó': 'o', 'ò': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o', 'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u', 'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ý': 'y', 'ỳ': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y'
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)

    text = re.sub(r'[\s,./\\]+', '-', text)  # Replace spaces and separators with a hyphen
    text = re.sub(r'[^a-z0-9-]', '', text)    # Remove invalid characters
    text = re.sub(r'-+', '-', text)          # Collapse multiple hyphens
    text = text.strip('-')                   # Remove leading/trailing hyphens
    return text

# ==============================================================================
# Easter Calculation and Key Movable Feasts
# ==============================================================================

def get_easter(year):
    """Calculates the date of Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)

def get_first_sunday_of_advent(year):
    """
    Finds the First Sunday of Advent for a given calendar year.
    It is the Sunday falling on or closest to November 30 (Rule #40).
    """
    nov30 = date(year, 11, 30)
    weekday = nov30.weekday() # Monday is 0, Sunday is 6

    # Find the Sunday on or before Nov 30
    sun_before = nov30 - timedelta(days=(weekday + 1) % 7)
    
    # Find the Sunday after Nov 30
    sun_after = nov30 + timedelta(days=(6 - weekday) % 7)

    # Return the one that is closer in days
    if (nov30 - sun_before) <= (sun_after - nov30):
        return sun_before
    else:
        return sun_after

def get_holy_family(year_of_christmas):
    """Finds the Feast of the Holy Family (Sunday within the Octave of Christmas) (Rule #35a)."""
    christmas = date(year_of_christmas, 12, 25)
    if christmas.weekday() == 6: # If Christmas is a Sunday, Holy Family is Dec 30.
        return date(year_of_christmas, 12, 30)
    # Otherwise, it's the Sunday after Christmas.
    for i in range(1, 8):
        d = christmas + timedelta(days=i)
        if d.weekday() == 6: # Sunday
            return d
    return None

def get_epiphany(year):
    """
    Calculates the Feast of the Epiphany.
    In Vietnam, it is celebrated on the Sunday between January 2 and January 8.
    """
    start_date = date(year, 1, 2)
    for i in range(7): # Iterate from Jan 2 to Jan 8
        d = start_date + timedelta(days=i)
        if d.weekday() == 6:  # Sunday
            return d
    return None # Should not be reached

def get_baptism_of_the_lord(epiphany_date):
    """
    Calculates the Feast of the Baptism of the Lord.
    It's the Sunday after Epiphany, unless Epiphany is on Jan 7 or 8,
    in which case the Baptism is celebrated on the following Monday.
    """
    # epiphany_date is always a Sunday from the get_epiphany function
    if epiphany_date.day in [7, 8]:
        return epiphany_date + timedelta(days=1)  # Following Monday
    else:
        return epiphany_date + timedelta(days=7)  # Following Sunday

def get_liturgical_dates(year):
    """Calculates all key liturgical dates for a given liturgical year."""
    easter = get_easter(year)
    pentecost = easter + timedelta(days=49)
    start_of_next_liturgical_year = get_first_sunday_of_advent(year)
    
    # Calculate Epiphany first, as Baptism of the Lord depends on it.
    epiphany = get_epiphany(year)
    baptism_of_the_lord = get_baptism_of_the_lord(epiphany)
    
    return {
        "start_of_liturgical_year": get_first_sunday_of_advent(year - 1),
        "christmas": date(year - 1, 12, 25),
        "holy_family": get_holy_family(year - 1),
        "epiphany": epiphany,
        "baptism_of_the_lord": baptism_of_the_lord,
        "ash_wednesday": easter - timedelta(days=46),
        "palm_sunday": easter - timedelta(days=7),
        "holy_thursday": easter - timedelta(days=3),
        "easter_sunday": easter,
        "pentecost_sunday": pentecost,
        "mary_mother_of_church": pentecost + timedelta(days=1),
        "trinity_sunday": pentecost + timedelta(days=7),
        "corpus_christi": pentecost + timedelta(days=14),
        "sacred_heart_of_jesus": pentecost + timedelta(days=19),
        "immaculate_heart_of_mary": pentecost + timedelta(days=20),
        "christ_the_king": start_of_next_liturgical_year - timedelta(days=7),
        "end_of_liturgical_year": start_of_next_liturgical_year
    }

# ==============================================================================
# Main Calendar Generation Logic
# ==============================================================================

def generate_liturgical_year(year):
    """Generates the full seasonal liturgical index for a given year."""
    dates = get_liturgical_dates(year)
    
    # Determine the Liturgical Year Cycle (A, B, C)
    start_year = year - 1
    cycle_map = {1: 'B', 2: 'C', 0: 'A'}
    year_cycle_letter = cycle_map[start_year % 3]
    year_cycle_suffix = f", Năm {year_cycle_letter}"
    
    calendar = {
        "mua-vong": [],
        "mua-giang-sinh": [],
        "mua-thuong-nien": [],
        "mua-chay": [],
        "mua-phuc-sinh": [],
        "trong-kinh-chua": []
    }
    
    day_names = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chúa Nhật"]
    
    current_date = dates["start_of_liturgical_year"]
    
    while current_date < dates["end_of_liturgical_year"]:
        entry = {"date": current_date.strftime("%Y-%m-%d")}
        season = ""
        
        # --- Determine the season and liturgy for the current date ---
        
        # 1. Advent
        if current_date < dates["christmas"]:
            season = "mua-vong"
            day, month = current_date.day, current_date.month
            
            if month == 12 and 17 <= day <= 24:
                entry["liturgy"] = f"Ngày {day} Tháng {month}"
            else:
                week = (current_date - dates["start_of_liturgical_year"]).days // 7 + 1
                entry["liturgy"] = f"Chúa Nhật {week} Mùa Vọng" if current_date.weekday() == 6 else f"{day_names[current_date.weekday()]}, Tuần {week} Mùa Vọng"

        # 2. Christmas Season
        elif current_date <= dates["baptism_of_the_lord"]:
            season = "mua-giang-sinh"
            day, month = current_date.day, current_date.month
            
            if current_date == dates["christmas"]: entry["liturgy"] = "Ngày 25 Tháng 12: Đại Lễ Giáng Sinh"
            elif month == 12 and day == 26: entry["liturgy"] = "Ngày 26 Tháng 12: St. Stêphanô, Tđ. tiên khởi"
            elif month == 12 and day == 27: entry["liturgy"] = "Ngày 27 Tháng 12: St. Gioan, Tông đồ"
            elif month == 12 and day == 28: entry["liturgy"] = "Ngày 28 Tháng 12: Các Thánh Anh Hài, Tđ."
            elif current_date == dates["holy_family"]: entry["liturgy"] = "Lễ Thánh Gia - Chúa Nhật trong Tuần Bát Nhật Giáng Sinh"
            elif month == 1 and day == 1: entry["liturgy"] = "Ngày 1 Tháng 1: Đức Trinh Nữ Maria, Mẹ Thiên Chúa, Lễ Trọng"
            elif current_date == dates["epiphany"]: entry["liturgy"] = "Lễ Chúa Hiển Linh"
            elif current_date == dates["baptism_of_the_lord"]: entry["liturgy"] = "Lễ Chúa Giêsu Chịu Phép Rửa"
            
            elif date(year, 1, 1) < current_date < dates["epiphany"]:
                entry["liturgy"] = f"Từ ngày 2 Tháng 1 đến Lễ Hiển Linh, {day_names[current_date.weekday()]}"
            elif dates["epiphany"] < current_date < dates["baptism_of_the_lord"]:
                entry["liturgy"] = f"Sau Lễ Hiển Linh đến Lễ Chúa Giêsu Chịu Phép Rửa - {day_names[current_date.weekday()]}"
            elif dates["christmas"] < current_date < date(year, 1, 1):
                entry["liturgy"] = f"{day_names[current_date.weekday()]} trong Tuần Bát Nhật Giáng Sinh"
            else:
                entry["liturgy"] = f"{day_names[current_date.weekday()]}, Mùa Giáng Sinh"

        # 3. Ordinary Time (Part 1)
        elif current_date < dates["ash_wednesday"]:
            season = "mua-thuong-nien"
            week = ((current_date - dates["baptism_of_the_lord"]).days // 7) + 1
            entry["liturgy"] = f"Chúa Nhật {week} Thường Niên" if current_date.weekday() == 6 else f"{day_names[current_date.weekday()]}, Tuần {week} Thường Niên"

        # 4. Lent (including Triduum)
        elif current_date < dates["easter_sunday"]:
            season = "mua-chay"
            if current_date >= dates["holy_thursday"]:
                if current_date.weekday() == 3: entry["liturgy"] = "Thứ Năm Tuần Thánh"
                elif current_date.weekday() == 4: entry["liturgy"] = "Thứ Sáu Tuần Thánh"
                else: entry["liturgy"] = "Thứ Bảy Tuần Thánh (Vọng Phục Sinh)"
            elif current_date >= dates["palm_sunday"]:
                entry["liturgy"] = "Chúa Nhật Lễ Lá" if current_date.weekday() == 6 else f"{day_names[current_date.weekday()]} Tuần Thánh"
            elif current_date == dates["ash_wednesday"]: 
                entry["liturgy"] = "Thứ Tư Lễ Tro"
            elif current_date < dates["ash_wednesday"] + timedelta(days=4):
                entry["liturgy"] = f"{day_names[current_date.weekday()]} sau Lễ Tro"
            else:
                first_sunday_of_lent = dates["ash_wednesday"] + timedelta(days=(6 - dates["ash_wednesday"].weekday() + 7) % 7)
                week = ((current_date - first_sunday_of_lent).days // 7) + 1
                entry["liturgy"] = f"Chúa Nhật {week} Mùa Chay" if current_date.weekday() == 6 else f"{day_names[current_date.weekday()]}, Tuần {week} Mùa Chay"
        
        # 5. Easter Season
        elif current_date < dates["pentecost_sunday"]:
            season = "mua-phuc-sinh"
            if current_date < dates["easter_sunday"] + timedelta(days=8):
                if current_date == dates["easter_sunday"]:
                    entry["liturgy"] = "Chúa Nhật Phục Sinh"
                else:
                    entry["liturgy"] = f"{day_names[current_date.weekday()]} trong Tuần Bát Nhật Phục Sinh"
            else:
                week = ((current_date - dates["easter_sunday"]).days // 7) + 1
                entry["liturgy"] = f"Chúa Nhật {week} Phục Sinh" if current_date.weekday() == 6 else f"{day_names[current_date.weekday()]}, Tuần {week} Phục Sinh"

        # 6. Feasts of the Lord & Ordinary Time (Part 2)
        else:
            if current_date == dates["pentecost_sunday"]:
                season = "trong-kinh-chua"
                entry["liturgy"] = "Lễ Chúa Thánh Thần Hiện Xuống"
            elif current_date == dates["mary_mother_of_church"]:
                season = "trong-kinh-chua"
                entry["liturgy"] = "Đức Trinh Nữ Maria, Mẹ Hội Thánh"
            elif current_date == dates["trinity_sunday"]:
                season = "trong-kinh-chua"
                entry["liturgy"] = "Lễ Chúa Ba Ngôi"
            elif current_date == dates["corpus_christi"]:
                season = "trong-kinh-chua"
                entry["liturgy"] = "Lễ Mình Máu Thánh Chúa"
            elif current_date == dates["sacred_heart_of_jesus"]:
                season = "trong-kinh-chua"
                entry["liturgy"] = "Lễ Thánh Tâm Chúa Giêsu"
            elif current_date == dates["immaculate_heart_of_mary"]:
                season = "trong-kinh-chua"
                entry["liturgy"] = "Lễ Trái Tim Vô Nhiễm Đức Mẹ Maria"
            else:
                season = "mua-thuong-nien"
                
                # --- CORRECTED WEEK CALCULATION ---
                # The last day of the liturgical year is the Saturday before the First Sunday of Advent.
                last_day_of_year = dates["end_of_liturgical_year"] - timedelta(days=1)
                
                # Calculate the week number by counting backwards from the 34th week.
                week = 34 - ((last_day_of_year - current_date).days // 7)
                
                if current_date == dates["christ_the_king"]:
                    entry["liturgy"] = f"Chúa Nhật {week} Thường Niên - Lễ Chúa Kitô Vua Vũ Trụ"
                elif current_date.weekday() == 6:
                    entry["liturgy"] = f"Chúa Nhật {week} Thường Niên"
                else:
                    entry["liturgy"] = f"{day_names[current_date.weekday()]}, Tuần {week} Thường Niên"
        
        # --- MODIFICATION: Add contentFile and year cycle suffix ---
        if "liturgy" in entry:
            # First, generate the contentFile path using the clean liturgy text
            clean_liturgy_text = entry["liturgy"]
            slug = slugify(clean_liturgy_text)
            entry["kinh-sach-file"] = f"db/phung-vu/kinh-sach/content/{season}/{slug}.json"
            
            # Second, add the year cycle suffix to the display liturgy text
            entry["liturgy"] += year_cycle_suffix

        calendar[season].append(entry)
        current_date += timedelta(days=1)
        
    return calendar

# ==============================================================================
# Script Execution
# ==============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate a Vietnamese liturgical calendar for a given year."
    )
    parser.add_argument(
        "year", 
        type=int, 
        help="The target liturgical year to generate the calendar for (e.g., 2026)."
    )
    args = parser.parse_args()
    target_year = args.year

    print(f"Generating liturgical calendar for {target_year}...")
    liturgical_calendar = generate_liturgical_year(target_year)
    
    file_name = f"liturgyIndex-{target_year}.json"
    with open(file_name, 'w', encoding='utf-8') as f:
        json.dump(liturgical_calendar, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Successfully generated and saved to '{file_name}'")