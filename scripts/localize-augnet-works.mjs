import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const translations = {
  '2100': 'Các Tác Phẩm của Thánh Augustinô',
  '2103': 'Khám Phá Thánh Augustinô',
  '2109': 'Phương Pháp Biên Soạn của Thánh Augustinô',
  '2110': 'Việc Xuất Bản các Tác Phẩm của Thánh Augustinô',
  '2111': 'Cái Đẹp và Cái Thích Hợp',
  '2112': 'Những Tác Phẩm Đầu Tiên',
  '2113': 'Các Cuộc Đối Thoại',
  '2114': 'Về Người Thầy',
  '2115': 'Về Đức Đồng Trinh Thánh Hiến',
  '2116': 'Về Thiện Ích của Hôn Nhân',
  '2117': 'Về Lao Động của các Đan Sĩ',
  '2118': 'Về Thiện Ích của Bậc Góa',
  '2119': 'Về Tôn Giáo Chân Thật',
  '2120': 'Chú Giải Thánh Vịnh',
  '2121A': 'Tám Mươi Ba Vấn Đề Khác Nhau',
  '2121B': 'Vấn Đề 71',
  '2123': 'Dẫn Nhập',
  '2124': 'Khái Lược',
  '2125': 'Triết Học và Thành Đô Thiên Chúa',
  '2126': 'Uy Tín của Thành Đô Thiên Chúa',
  '2127': 'Tâm Lý Học trong Thành Đô Thiên Chúa',
  '2128': 'Cuộc Cướp Phá Rôma',
  '2130': 'Nội Dung Thành Đô Thiên Chúa',
  '2131': 'Chủ Đề của Thành Đô Thiên Chúa',
  '2132': 'Bản Tiếng Anh Thành Đô Thiên Chúa',
  '2133': 'Về Giáo Lý Kitô Giáo',
  '2135': 'Về Chúa Ba Ngôi',
  '2137': 'Dẫn Nhập',
  '2138': 'Vì Sao Tự Thuật Được Viết?',
  '2139': 'Nhan Đề và Nội Dung Tự Thuật',
  '2140': 'Khái Lược các Quyển Tự Thuật',
  '2141': 'Dành Cho Độc Giả',
  '2142': 'Các Liên Kết về Tự Thuật',
  '2143': 'Huấn Giáo cho Người Sơ Học',
  '2144': 'Tu Luật Thánh Augustinô',
  '2145': 'Chú Giải Thư Thứ Nhất của Thánh Gioan',
  '2146': 'Chú Giải Tin Mừng theo Thánh Gioan',
  '2147': 'Cẩm Nang Đức Tin, Đức Cậy và Đức Mến',
  '2148': 'Duyệt Lại các Tác Phẩm',
  '2150': 'Về Các Bài Giảng của Thánh Augustinô',
  '2151': 'Những Bài Giảng Thất Truyền',
  '2152': 'Những Bài Giảng Giả Mạo',
  '2153': 'Thư Từ',
  '2154': 'Thư Gửi Bà Proba',
  '2155': 'Thư Trao Đổi với Thánh Giêrônimô I',
  '2156': 'Thư Trao Đổi với Thánh Giêrônimô II',
  '2201': 'Dẫn Nhập về Linh Đạo',
  '2235': 'Lý Tưởng Giêrusalem',
  '2236': 'Phân Định Thiêng Liêng',
  '2237': 'Nỗi Khắc Khoải Thiêng Liêng',
  '2238': 'Đời Sống Nội Tâm',
  '2240': 'Otium – Sự Nhàn Tĩnh Thánh Thiện',
  '2241': 'Tình Yêu Thiêng Liêng',
  '2242': 'Những Yếu Tố Linh Đạo',
  '2243': 'Con Tim Thiêng Liêng',
  '2244': 'Tư Tưởng Linh Đạo của Thánh Augustinô',
  '2245': 'Kinh Nghiệm Thần Bí của Thánh Augustinô',
  '2246': 'Linh Hướng',
  '2247': 'Cầu Nguyện',
  '2248': 'Kinh Lạy Cha',
  '2250': 'Sự Quan Phòng của Thiên Chúa',
  '2252': 'Linh Đạo Augustinô',
  '2254': 'Những Chiều Kích Linh Đạo',
  '2302': 'Nhân Học',
  '2303': 'Nghi Thức An Táng',
  '2304': 'Đời Sống Kitô Hữu',
  '2305': 'Sự Hoán Cải',
  '2306': 'Sự Dữ',
  '2308': 'Tình Bạn',
  '2309': 'Bài Giảng về Tình Bạn',
  '2311': 'Thánh Augustinô Bàn về Tình Bạn',
  '2312': 'Vai Trò của Lịch Sử',
  '2313': 'Đức Khiêm Nhường',
  '2314': 'Nạn Đói',
  '2315': 'Nghèo Khó và Nạn Đói',
  '2317': 'Công Lý',
  '2318': 'Công Lý và Hòa Bình',
  '2319': 'Lâm Bô',
  '2320': 'Tình Yêu',
  '2321': 'Những Người Bị Gạt Ra Bên Lề',
  '2322': 'Các Vị Tử Đạo',
  '2323': 'Đức Maria',
  '2324': 'Các Phép Lạ',
  '2325': 'Người Nghèo',
  '2328': 'Tính Kiêu Ngạo',
  '2329': 'Sự Quan Phòng',
  '2330': 'Thánh Tích',
  '2331': 'Kỳ Thị Giới Tính',
  '2332': 'Tính Dục',
  '2333': 'Xã Hội',
  '2337': 'Dẫn Nhập Thần Học',
  '2338': 'Thánh Tôma Aquinô',
  '2339': 'Bí Tích Thánh Thể',
  '2340': 'Ân Sủng',
  '2341': 'Tiền Định',
  '2342': 'Chiến Tranh',
  '2343': 'Đức Kitô Toàn Thể',
  '2347': 'Thế Giới Quan',
  '2402': 'Giáo Dục',
  '2403': 'Chính Quyền',
  '2404': 'Các Môn Khai Phóng',
  '2405': 'Đời Đan Tu',
  '2407': 'Triết Học',
  '2408': 'Chính Trị',
  '2411': 'Giảng Thuyết',
  '2430': 'Tâm Lý Học',
  '2431': 'Huấn Giáo',
  '2435': 'Tu Từ Học',
  '2436': 'Ca Hát',
  '2437': 'Chế Độ Nô Lệ',
};

const contentRoot = fileURLToPath(new URL('../src/content/augustine-works/', import.meta.url));
const files = [];

async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const itemPath = path.join(directory, item.name);
    if (item.isDirectory()) await walk(itemPath);
    else if (/\.mdx?$/.test(item.name)) files.push(itemPath);
  }
}

await walk(contentRoot);
const seen = new Set();

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const code = source.match(/^code:\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1];
  if (!code || !translations[code]) throw new Error(`Không có bản dịch cho ${code || file}`);
  const localized = source.replace(/^titleVi:.*$/m, `titleVi: ${JSON.stringify(translations[code])}`);
  if (localized === source) throw new Error(`Không tìm thấy titleVi trong ${file}`);
  await writeFile(file, localized, 'utf8');
  seen.add(code);
}

const missing = Object.keys(translations).filter((code) => !seen.has(code));
if (missing.length) throw new Error(`Thiếu file cho mã: ${missing.join(', ')}`);
console.log(`Đã Việt hóa ${seen.size} tiêu đề Augnet.`);
