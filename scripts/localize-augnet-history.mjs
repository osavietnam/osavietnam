import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contentRoot = fileURLToPath(new URL('../src/content/augnet-history/', import.meta.url));

const general = {
  '15th century': 'Thế Kỷ XV',
  'the bible': 'Kinh Thánh',
  'witchcraft': 'Ma Thuật và Phù Thủy',
  'savanarola': 'Girolamo Savonarola',
  'later libraries': 'Các Thư Viện Hậu Kỳ',
  'reformation': 'Cuộc Cải Cách',
  'augustinian statistics in 1517': 'Thống Kê về Dòng Thánh Augustinô Năm 1517',
  'king philip ii': 'Vua Philip II',
  '16th century new world': 'Tân Thế Giới trong Thế Kỷ XVI',
  '16th century pacific': 'Thái Bình Dương trong Thế Kỷ XVI',
  'circumnavigation': 'Hành Trình Vòng Quanh Thế Giới',
  '17th-18th centuries': 'Thế Kỷ XVII–XVIII',
  '19th century': 'Thế Kỷ XIX',
  'from 1800 to 1877': 'Giai Đoạn 1800–1877',
  'from 1878 to 1902': 'Giai Đoạn 1878–1902',
  'priors general': 'Các Bề Trên Tổng Quyền',
  'historical bibliography': 'Thư Mục Lịch Sử',
  'a general overview': 'Tổng Quan',
  'monastic prelude': 'Tiền Đề Đan Tu',
  'canons begin': 'Khởi Đầu của các Kinh Sĩ',
  'augustinian canons': 'Các Kinh Sĩ theo Tu Luật Thánh Augustinô',
  'via francigena': 'Con Đường Via Francigena',
  'ancient hermitages': 'Các Ẩn Viện Cổ',
  'hermitages overview': 'Tổng Quan về các Ẩn Viện',
  's giorgo della spelonca': 'Ẩn Viện San Giorgio della Spelonca',
  's. maria di lupocavo': 'Ẩn Viện Santa Maria di Lupocavo',
  's. maria di montespecchio': 'Ẩn Viện Santa Maria di Montespecchio',
  's. gugliemlo a malavalle': 'Ẩn Viện San Guglielmo a Malavalle',
  'centumcellae': 'Ẩn Viện Centumcellae',
  'mendicant movement': 'Phong Trào Khất Sĩ',
  'little union': 'Tiểu Liên Kết',
  'grand union': 'Đại Liên Kết',
  'opportunities': 'Những Cơ Hội',
  'opportunities and dangers': 'Cơ Hội và Nguy Cơ',
  'augustinian identity': 'Căn Tính Augustinô',
  'early leaders': 'Những Nhà Lãnh Đạo Thuở Đầu',
  'learning': 'Học Thuật',
  'early libraries': 'Các Thư Viện Thuở Đầu',
  'religious poverty': 'Đức Nghèo Khó Tu Trì',
  'discipline': 'Kỷ Luật Tu Trì',
  'carmelites': 'Dòng Cát Minh',
  'assumptionists': 'Dòng Augustinô Đức Mẹ Lên Trời',
  'augustinian recollects': 'Dòng Augustinô Hồi Tâm',
  'sack friars': 'Dòng Anh Em Bao Bị',
  'the constitutions': 'Hiến Pháp của Dòng',
  'augustinian constitutions': 'Hiến Pháp Dòng Thánh Augustinô',
  'humanism': 'Chủ Nghĩa Nhân Văn',
  'rennaissance': 'Thời Phục Hưng',
  'observant movement': 'Phong Trào Tuân Thủ Nghiêm Ngặt',
  'first 100 years': 'Một Trăm Năm Đầu Tiên',
  'first augustinian 100 years': 'Một Trăm Năm Đầu của Dòng Thánh Augustinô',
  'constitutions germany': 'Hiến Pháp tại Đức',
  'black death': 'Đại Dịch Cái Chết Đen',
  'great western schism': 'Đại Ly Giáo Tây Phương',
  '14th century': 'Thế Kỷ XIV',
  'papal chaplaincies': 'Các Tuyên Úy Giáo Hoàng',
  'before the augustinians': 'Trước Thời Dòng Thánh Augustinô',
};

const regions = {
  'africa': 'Châu Phi',
  'asia-pacific': 'Châu Á – Thái Bình Dương',
  'algeria': 'Algérie',
  'australia': 'Úc',
  'bangladesh': 'Bangladesh',
  'belgium': 'Bỉ',
  'benin': 'Bénin',
  'canada': 'Canada',
  'czech republic': 'Cộng Hòa Séc',
  'congo': 'Congo',
  'england': 'Anh',
  'france': 'Pháp',
  'germany': 'Đức',
  'hungary': 'Hungary',
  'india': 'Ấn Độ',
  'india: goa': 'Ấn Độ – Goa',
  'indonesia': 'Indonesia',
  'iran': 'Iran',
  'ireland': 'Ireland',
  'japan': 'Nhật Bản',
  'kenya': 'Kenya',
  'korea': 'Hàn Quốc',
  'latin america': 'Châu Mỹ Latinh',
  'macau': 'Ma Cao',
  'malta': 'Malta',
  'mexico': 'Mexico',
  'netherlands': 'Hà Lan',
  'nigeria': 'Nigeria',
  'philippines': 'Philippines',
  'poland': 'Ba Lan',
  'portugal': 'Bồ Đào Nha',
  'slovakia': 'Slovakia',
  'spain': 'Tây Ban Nha',
  'sri lanka': 'Sri Lanka',
  'tanzania': 'Tanzania',
  'wales & scotland': 'Wales và Scotland',
  'middle east': 'Trung Đông',
};

const places = {
  'austria – vienna': 'Áo – Vienna',
  'czech rep. – brno': 'Cộng Hòa Séc – Brno',
  'czech rep. – prague': 'Cộng Hòa Séc – Praha',
  'ecuador – san callo': 'Ecuador – San Callo',
  'ecuador – quito': 'Ecuador – Quito',
  'england – atherstone': 'Anh – Atherstone',
  'england cambridge': 'Anh – Cambridge',
  'england – clare': 'Anh – Clare',
  'england – hull': 'Anh – Hull',
  'england – leicester': 'Anh – Leicester',
  'england – london': 'Anh – Luân Đôn',
  'england – oxford': 'Anh – Oxford',
  'england': 'Anh',
  'england oxford': 'Anh – Oxford',
  'england – rye': 'Anh – Rye',
  'england – winchester': 'Anh – Winchester',
  'france paris': 'Pháp – Paris',
  'france toulouse': 'Pháp – Toulouse',
  'germany erfurt': 'Đức – Erfurt',
  'hungary – buda': 'Hungary – Buda',
  'indonesia – ayawasi': 'Indonesia – Ayawasi',
  'indonesia – susweni': 'Indonesia – Susweni',
  'ireland': 'Ireland',
  'ireland – dublin': 'Ireland – Dublin',
  'ireland – dunmore': 'Ireland – Dunmore',
  'ireland – murrisk': 'Ireland – Murrisk',
  'italy angelica library': 'Ý – Thư Viện Angelica',
  'italy – cascia': 'Ý – Cascia',
  'italy florence': 'Ý – Firenze',
  'italy – genazzano': 'Ý – Genazzano',
  'italy – gubbio': 'Ý – Gubbio',
  'italy lecceto': 'Ý – Lecceto',
  'italy maria del popolo': 'Ý – Santa Maria del Popolo',
  'italy – milan': 'Ý – Milano',
  'italy curia osa': 'Ý – Trụ Sở Trung Ương OSA',
  'italy – pavia': 'Ý – Pavia',
  'italy rosia': 'Ý – Rosia',
  'italy rome santagostino church': "Ý – Rôma – Nhà Thờ Sant'Agostino",
  'italy rome convento santagostino': "Ý – Rôma – Tu Viện Sant'Agostino",
  'italy san gallo': 'Ý – San Gallo',
  'italy – san gallo': 'Ý – San Gallo',
  'italy san gimignano': 'Ý – San Gimignano',
  'italy san leonardo al lago': 'Ý – San Leonardo al Lago',
  'italy – rome – st monica’s college': 'Ý – Rôma – Học Viện Thánh Mônica',
  'italy – rome – santa suzanna': 'Ý – Rôma – Santa Susanna',
  'italy – siena': 'Ý – Siena',
  'italy – tolentino': 'Ý – Tolentino',
  'japan – nagasaki': 'Nhật Bản – Nagasaki',
  'malta – rabat': 'Malta – Rabat',
  'mexico monasteries': 'Các Đan Viện tại Mexico',
  'mexico – actopan': 'Mexico – Actopan',
  'mexico – morelia': 'Mexico – Morelia',
  'mexico – oaxaca': 'Mexico – Oaxaca',
  'mexico – queretaro': 'Mexico – Querétaro',
  'mexico – salamanca': 'Mexico – Salamanca',
  'mexico – yuriria': 'Mexico – Yuriria',
  'peru – lima': 'Peru – Lima',
  'philippines – cebu': 'Philippines – Cebu',
  'philippines – intramuros church': 'Philippines – Nhà Thờ Intramuros',
  'philippines – intramuros museum': 'Philippines – Bảo Tàng Intramuros',
  'poland – krakow': 'Ba Lan – Kraków',
  'spain – escorial': 'Tây Ban Nha – El Escorial',
  'spain – la vid': 'Tây Ban Nha – La Vid',
  'spain – valladolid': 'Tây Ban Nha – Valladolid',
  'usa – philadelphia': 'Hoa Kỳ – Philadelphia',
  'usa – merrimack': 'Hoa Kỳ – Merrimack',
  'usa – villanova': 'Hoa Kỳ – Villanova',
  'mexico': 'Mexico',
  'england – oxford': 'Anh – Oxford',
};

const people = {
  'augustinian saints': 'Các Thánh Dòng Thánh Augustinô',
  'anonymous florentine': 'Tu Sĩ Vô Danh thành Firenze',
  'bartholomew of urbino': 'Bartholomew thành Urbino',
  'augustine of canterbury': 'Thánh Augustinô thành Canterbury',
  'john of basel': 'John thành Basel',
  'clement of osimo': 'Clement thành Osimo',
  'pope eugene iv': 'Đức Giáo Hoàng Eugene IV',
  'giles of rome': 'Giles thành Rôma',
  'giles of viterbo_01': 'Giles thành Viterbo – Phần 01',
  'henry of friemar': 'Henry thành Friemar',
  'jordan of saxony': 'Jordan thành Saxony',
  'pope leo xiii': 'Đức Giáo Hoàng Leo XIII',
  'luther in rome': 'Luther tại Rôma',
  'luther and augustine': 'Luther và Thánh Augustinô',
  'nicholas of alessandria': 'Nicholas thành Alessandria',
  'king philip ii of spain': 'Vua Philip II của Tây Ban Nha',
  'gregory of rimini': 'Gregory thành Rimini',
  'dionigi di borgo san sepolcro': 'Dionigi thành Borgo San Sepolcro',
  'thomas of strasburg': 'Thomas thành Strasbourg',
  'augustine of tarano': 'Augustinô thành Tarano',
  'giles of viterbo_02': 'Giles thành Viterbo – Phần 02',
  'giles of viterbo_03': 'Giles thành Viterbo – Phần 03',
  'giles of viterbo_04': 'Giles thành Viterbo – Phần 04',
  'william of cremona': 'William thành Cremona',
  'william of monklane': 'William thành Monklane',
  'biography – erfurt': 'Tiểu Sử – Erfurt',
  'biography – wittenberg': 'Tiểu Sử – Wittenberg',
  'biography – pressures': 'Tiểu Sử – Những Áp Lực',
  'biography – 95 theses': 'Tiểu Sử – 95 Luận Đề',
  'biography – twilight': 'Tiểu Sử – Những Năm Cuối Đời',
  'biography young man': 'Tiểu Sử – Thời Niên Thiếu',
  'giles of viterbo': 'Giles thành Viterbo',
};

function splitPart(title) {
  const match = title.match(/^(.*?)(?:\s+[–-]\s+|_+|\s+)(0[1-9]|[1-9]\d)$/u);
  return match ? { base: match[1].trim(), part: match[2] } : { base: title.trim(), part: '' };
}

function tidyProperName(value) {
  const minor = new Set(['de', 'di', 'da', 'del', 'della', 'of', 'von', 'in', 'and']);
  return value.split(/(\s+|_)/).map((token, index) => {
    if (/^\s+$|^_$/.test(token)) return token === '_' ? ' ' : token;
    const lower = token.toLocaleLowerCase('en');
    if (index > 0 && minor.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase('en') + lower.slice(1);
  }).join('');
}

function translate(title, category) {
  const exactKey = title.trim().toLocaleLowerCase('en');
  if (category === 'people' && people[exactKey]) return people[exactKey];

  const { base, part } = splitPart(title);
  const key = base.toLocaleLowerCase('en');
  let translated;
  if (category === 'general') translated = general[key];
  else if (category === 'regional-history') translated = regions[key];
  else if (category === 'places') translated = places[key];
  else if (category === 'people') translated = people[key] ?? tidyProperName(base);

  if (!translated) return null;
  return part ? `${translated} – Phần ${part}` : translated;
}

const files = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const itemPath = path.join(directory, item.name);
    if (item.isDirectory()) await walk(itemPath);
    else if (/\.mdx?$/.test(item.name)) files.push(itemPath);
  }
}

await walk(contentRoot);
const localized = [];
const missing = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const titleEn = JSON.parse(source.match(/^titleEn:\s*(.+)$/m)?.[1] ?? 'null');
  const category = JSON.parse(source.match(/^categorySlug:\s*(.+)$/m)?.[1] ?? 'null');
  if (!titleEn || !category) throw new Error(`Frontmatter không hợp lệ: ${file}`);
  const titleVi = translate(titleEn, category);
  if (!titleVi) {
    missing.push(`[${category}] ${titleEn}`);
    continue;
  }
  const output = source.replace(/^titleVi:.*$/m, `titleVi: ${JSON.stringify(titleVi)}`);
  if (output === source && !source.includes(`titleVi: ${JSON.stringify(titleVi)}`)) {
    throw new Error(`Không tìm thấy titleVi: ${file}`);
  }
  await writeFile(file, output, 'utf8');
  localized.push({ file, titleEn, titleVi });
}

if (missing.length) throw new Error(`Chưa có bản dịch:\n${missing.join('\n')}`);
console.log(`Đã Việt hóa ${localized.length} tiêu đề lịch sử Augnet.`);
