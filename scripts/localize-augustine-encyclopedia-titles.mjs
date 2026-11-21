import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const contentDir = path.join(projectRoot, 'src', 'content', 'augustine-encyclopedia');
const augustinePagePath = path.join(projectRoot, 'src', 'pages', 'thanh-au-tinh', 'index.astro');

const normalize = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const reorderLatinTitle = (title) => {
  const match = title.match(/^(.+),\s*(Contra|De|Ad|In)$/i);
  if (match) return `${match[2]} ${match[1]}`;

  const deModifier = title.match(/^(.+),\s*De\s+(bono|dono|sancta)$/i);
  if (deModifier) return `De ${deModifier[2]} ${deModifier[1]}`;

  return title;
};

// Các tên dưới đây là bản dịch làm việc, ưu tiên thuật ngữ Công giáo–triết học
// quen dùng. Frontmatter vẫn là nguồn chính để người biên tập thay từng mục sau.
const direct = {
  'Abortion': 'Phá Thai',
  'Abraham': 'Tổ Phụ Abraham',
  'Abstinence': 'Tiết Chế',
  'Acta contra Fortunatum': 'Biên Bản Tranh Luận với Fortunatus',
  'Academics': 'Phái Hàn Lâm',
  'Acies mentis': 'Nhãn Quan Tinh Thần',
  'Adam and Eve': 'Ađam và Evà',
  'Adeodatus': 'Ađêôđatô',
  'Adimantum, Contra': 'Chống Adimantus',
  'Adnotationes in Iob': 'Ghi Chú về Sách Gióp',
  'Adomnán': 'Adomnán',
  'Adulterinis conjugiis, De': 'Về Các Cuộc Hôn Nhân Ngoại Tình',
  'Adultery': 'Ngoại Tình',
  'Adversus Judaeos': 'Chống Người Do Thái',
  'Aegidius Romanus': 'Giles thành Rôma',
  'Allegory': 'Nghĩa Ẩn Dụ',
  'Almsgiving': 'Bố Thí',
  'Alypius': 'Alypiô',
  'Ambrose of Milan': 'Thánh Ambrôsiô thành Milan',
  'Anagogy': 'Nghĩa Hướng Thượng',
  'Angels': 'Các Thiên Thần',
  'Anselm of Canterbury': 'Thánh Anselmô thành Canterbury',
  'Anthropology': 'Nhân Học',
  'Anti-Arian Works': 'Các Tác Phẩm Chống Phái Ariô',
  'Anti-Donatist Works': 'Các Tác Phẩm Chống Phái Donatus',
  'Anti-Manichean Works': 'Các Tác Phẩm Chống Phái Manikê',
  'Anti-Pelagian works': 'Các Tác Phẩm Chống Phái Pelagiô',
  'Antoninus of Fussala': 'Antoninus thành Fussala',
  'Antony of Egypt': 'Thánh Antôn Ai Cập',
  'Apocalypticism': 'Tư Tưởng Khải Huyền',
  'Apostles’ Creed': 'Kinh Tin Kính Các Tông Đồ',
  'Aquinas, Thomas': 'Thánh Tôma Aquinô',
  'Archaeology': 'Khảo Cổ Học',
  'Aristotle': 'Aristốt',
  'Aristotle, Augustine’s Knowledge of': 'Hiểu Biết của Thánh Augustinô về Aristốt',
  'Arius, Arianism': 'Ariô và Phái Ariô',
  'Arnobius the Younger': 'Arnobius Trẻ',
  'Ascent of the Soul': 'Sự Thăng Tiến của Linh Hồn',
  'Asceticism': 'Khổ Chế',
  'Asceticism, Pre-Augustine': 'Khổ Chế Trước Thánh Augustinô',
  'Astrology': 'Chiêm Tinh Học',
  'Athanasius': 'Thánh Athanasiô',
  'Augustine’s Life': 'Cuộc Đời Thánh Augustinô',
  'Authority': 'Thẩm Quyền',
  'Babylon': 'Babylon',
  'Baptism': 'Phép Rửa',
  'Barbarian Invasions': 'Các Cuộc Xâm Lăng của Người Man Di',
  'Basil of Caesarea': 'Thánh Basiliô thành Cêsarê',
  'Bede, Venerable': 'Thánh Bêđa Khả Kính',
  'Beginning of Faith': 'Khởi Điểm của Đức Tin',
  'Being (esse/essentia)': 'Hữu Thể (Esse/Essentia)',
  'Bernard of Clairvaux': 'Thánh Bênađô thành Clairvaux',
  'Bible': 'Kinh Thánh',
  'Body': 'Thân Xác',
  'Bonaventure': 'Thánh Bônaventura',
  'Bono conjugali, De': 'Về Thiện Ích của Hôn Nhân',
  'Caesarius of Arles': 'Thánh Caesarius thành Arles',
  'Calvin, John': 'Jean Calvin',
  'Canon of Sacred Scripture, Septuagint': 'Quy Điển Kinh Thánh và Bản Bảy Mươi',
  'Canons of North Africa': 'Các Giáo Luật Bắc Phi',
  'Carolingian Era, Early': 'Thời Caroling Sơ Kỳ',
  'Carolingian Era, Late': 'Thời Caroling Hậu Kỳ',
  'Cassian, John': 'Gioan Cassianô',
  'Cassiciacum Dialogues': 'Các Đối Thoại tại Cassiciacum',
  'Catechesis': 'Giáo Lý',
  'Catechumens, Catechumenate': 'Dự Tòng và Thời Kỳ Dự Tòng',
  'Catholic, Church as': 'Đặc Tính Công Giáo của Hội Thánh',
  'Celibacy': 'Độc Thân',
  'Charity': 'Đức Mến',
  'Christian Influences on Augustine': 'Những Ảnh Hưởng Kitô Giáo trên Thánh Augustinô',
  'Christian Worship': 'Phụng Tự Kitô Giáo',
  'Christology': 'Kitô Học',
  'Church': 'Hội Thánh',
  'Church and State': 'Hội Thánh và Nhà Nước',
  'Church, North African': 'Hội Thánh Bắc Phi',
  'Cicero, Marcus Tullius': 'Marcus Tullius Cicero',
  'Circumcellions': 'Nhóm Circumcellion',
  'Citizen': 'Công Dân',
  'City of God': 'Thành Đô Thiên Chúa',
  'Classical Authors': 'Các Tác Giả Cổ Điển',
  'Classical influences on Augustine': 'Những Ảnh Hưởng Cổ Điển trên Thánh Augustinô',
  'Clergy, North African': 'Giáo Sĩ Bắc Phi',
  'Code of the Canons of the North African Church': 'Bộ Giáo Luật của Hội Thánh Bắc Phi',
  'Collatio of 411': 'Hội Nghị Năm 411',
  'Common Good': 'Công Ích',
  'Concubine/Concubinage': 'Tỳ Thiếp và Việc Chung Sống Không Hôn Phối',
  'Concupiscence': 'Dục Vọng',
  'Confessiones': 'Tự Thuật',
  'Contemplation and Action': 'Chiêm Niệm và Hoạt Động',
  'Continence': 'Tiết Dục',
  'Contraception': 'Ngừa Thai',
  'Conversion': 'Hoán Cải',
  'Correction': 'Sửa Dạy',
  'Cosmography': 'Vũ Trụ Chí',
  'Cosmology': 'Vũ Trụ Học',
  'Councils of North African Bishops': 'Các Công Đồng Giám Mục Bắc Phi',
  'Councils of Orange': 'Các Công Đồng Orange',
  'Creation': 'Công Trình Sáng Tạo',
  'Creed, Symbolum': 'Kinh Tin Kính (Symbolum)',
  'Cresconium grammaticum partis Donati, Contra': 'Chống Cresconius, Nhà Ngữ Pháp Phái Donatus',
  'Cult of Augustine’s Body (Arca di S. Agostino)': 'Việc Tôn Kính Thánh Thể Thánh Augustinô',
  'Curiosity': 'Tính Tò Mò',
  'Cyberspace, Augustine in': 'Thánh Augustinô trên Không Gian Mạng',
  'Cyprian of Carthage': 'Thánh Cyprianô thành Carthage',
  'Death': 'Sự Chết',
  'Definitiones (Caelestius)': 'Các Luận Đề của Caelestius',
  'Deification, Divinization': 'Thần Hóa',
  'Demons': 'Ma Quỷ',
  'Devil': 'Ác Quỷ',
  'Dialectic': 'Biện Chứng Pháp',
  'Disciplinae liberales': 'Các Môn Học Khai Phóng',
  'Discipline (correctio)': 'Kỷ Luật (Correctio)',
  'Discipline (correptio, admonitio)': 'Kỷ Luật (Correptio, Admonitio)',
  'Divinization': 'Thần Hóa',
  'Donatist Bishops': 'Các Giám Mục Phái Donatus',
  'Donatistas post conlationem, Contra': 'Chống Phái Donatus sau Hội Nghị',
  'Donatus, Donatism': 'Donatus và Phái Donatus',
  'Ecclesiology': 'Giáo Hội Học',
  'Eschatology': 'Cánh Chung Học',
  'Enchiridion': 'Cẩm Nang về Đức Tin, Đức Cậy và Đức Mến',
  'Epistula ad Romanos inchoata expositio': 'Chú Giải Dang Dở Thư Gửi Tín Hữu Rôma',
  'Eternity': 'Vĩnh Cửu',
  'Ethics': 'Đạo Đức Học',
  'Eucharist': 'Thánh Thể',
  'Eusebius of Caesarea': 'Eusebius thành Cêsarê',
  'Evil': 'Sự Dữ',
  'Evodius of Uzalis': 'Evodius thành Uzalis',
  'Excommunication': 'Vạ Tuyệt Thông',
  'Faith': 'Đức Tin',
  'Faith, Hope, and Love': 'Đức Tin, Đức Cậy và Đức Mến',
  'Fall': 'Sự Sa Ngã',
  'Fall of Rome': 'Sự Sụp Đổ của Rôma',
  'Family, Relatives': 'Gia Đình và Thân Thuộc',
  'Fasting': 'Ăn Chay',
  'Faustus of Milevis': 'Faustus thành Milevis',
  'Faustus of Riez': 'Faustus thành Riez',
  'Fear of Death': 'Nỗi Sợ Sự Chết',
  'Felicitas': 'Thánh Felicitas',
  'Felix of Apthungi': 'Felix thành Apthungi',
  'Fifth Century': 'Thế Kỷ V',
  'Figure, Allegory': 'Hình Bóng và Ẩn Dụ',
  'Filioque': 'Filioque',
  'Florilegia': 'Hợp Tuyển',
  'Fortunatum Manicheum, Acta contra': 'Biên Bản Tranh Luận với Fortunatus, Người Manikê',
  'Fraternal Correction': 'Sửa Lỗi Huynh Đệ',
  'Freedom': 'Tự Do',
  'Friendship, Friends': 'Tình Bạn và Bằng Hữu',
  'Fulgentius of Ruspe': 'Thánh Fulgentius thành Ruspe',
  'Gender, Sex': 'Giới và Phái Tính',
  'Genesis Accounts of Creation': 'Các Trình Thuật Sáng Tạo trong Sách Sáng Thế',
  'Genesi ad litteram liber, De': 'Chú Giải Sách Sáng Thế theo Nghĩa Đen',
  'Genesi ad litteram liber imperfectus, De': 'Chú Giải Chưa Hoàn Tất Sách Sáng Thế theo Nghĩa Đen',
  'Genesi adversus Manicheos, De': 'Về Sách Sáng Thế Chống Phái Manikê',
  'Giles of Rome': 'Giles thành Rôma',
  'God': 'Thiên Chúa',
  'Goodness': 'Sự Thiện',
  'Grace': 'Ân Sủng',
  'Gratia Testamenti Novi, De': 'Về Ân Sủng của Tân Ước',
  'Gregory I': 'Thánh Grêgôriô Cả',
  'Gregory Nazianzen': 'Thánh Grêgôriô Nazianzô',
  'Gregory of Nyssa': 'Thánh Grêgôriô thành Nyssa',
  'Gregory of Rimini': 'Grêgôriô thành Rimini',
  'Grosseteste, Robert': 'Robert Grosseteste',
  'Guilt, Fault': 'Tội Trạng và Lỗi Phạm',
  'Habit (consuetudo)': 'Tập Quán (Consuetudo)',
  'Habit (habitus)': 'Tập Tính (Habitus)',
  'Happiness, Eudaimonism': 'Hạnh Phúc và Thuyết Hạnh Phúc',
  'Health, Sickness': 'Sức Khỏe và Bệnh Tật',
  'Heaven, Paradise': 'Thiên Đàng',
  'Hell, Damnation': 'Hỏa Ngục và Án Phạt',
  'Heresy, Schism': 'Lạc Giáo và Ly Giáo',
  'Hermeneutical Presuppositions': 'Các Tiền Giả Định Thông Diễn Học',
  'Hermetic Tradition': 'Truyền Thống Hermetic',
  'Hilary of Poitiers': 'Thánh Hilariô thành Poitiers',
  'Hippo Regius': 'Hippô Regius',
  'History': 'Lịch Sử',
  'Holy Spirit': 'Chúa Thánh Thần',
  'Homily': 'Bài Giảng',
  'Humility': 'Đức Khiêm Nhường',
  'Illumination, Divine': 'Sự Soi Sáng Thần Linh',
  'Image Doctrine': 'Học Thuyết về Hình Ảnh Thiên Chúa',
  'Imagination': 'Trí Tưởng Tượng',
  'Immortality': 'Sự Bất Tử',
  'Incarnation': 'Mầu Nhiệm Nhập Thể',
  'Initium fidei': 'Khởi Điểm của Đức Tin',
  'Innocent I': 'Đức Giáo Hoàng Innocentê I',
  'Intellectus': 'Trí Năng',
  'Interiority': 'Nội Tâm',
  'Irenaeus': 'Thánh Irênê',
  'Isidore of Seville': 'Thánh Isidôrô thành Seville',
  'Jansenius, Cornelius': 'Cornelius Jansenius',
  'Jerome': 'Thánh Giêrônimô',
  'Jerusalem': 'Giêrusalem',
  'Jesus Christ': 'Đức Giêsu Kitô',
  'Jews and Judaism': 'Người Do Thái và Do Thái Giáo',
  'John Cassian': 'Gioan Cassianô',
  'Judgment, Last': 'Phán Xét Chung',
  'Julian of Eclanum': 'Julianus thành Eclanum',
  'Justice': 'Công Lý',
  'Knowledge': 'Tri Thức',
  'Lapsi': 'Các Kitô Hữu Sa Ngã',
  'Law, Natural': 'Luật Tự Nhiên',
  'Letters': 'Thư Từ',
  'Liberal Arts': 'Các Môn Khai Phóng',
  'Liberty': 'Tự Do',
  'Liturgy': 'Phụng Vụ',
  'Locutionum in Heptateuchum': 'Các Cách Diễn Đạt trong Ngũ Thư và Các Sách Tiếp Theo',
  'Lord’s Prayer': 'Kinh Lạy Cha',
  'Lord’s Supper': 'Bữa Tiệc của Chúa',
  'Love': 'Tình Yêu',
  'Luther, Martin': 'Martin Luther',
  'Mani, Manicheism': 'Mani và Mani Giáo',
  'Manuscripts': 'Các Bản Thảo',
  'Marius Victorinus': 'Marius Victorinus',
  'Marriage': 'Hôn Nhân',
  'Martin Luther': 'Martin Luther',
  'Martyrdom': 'Phúc Tử Đạo',
  'Mary, Mother of God': 'Đức Maria, Mẹ Thiên Chúa',
  'Massa': 'Khối Nhân Loại (Massa)',
  'Mathematici': 'Các Nhà Chiêm Tinh (Mathematici)',
  'Matter': 'Vật Chất',
  'Maximino Arianorum episcopum, Conlatio con': 'Cuộc Tranh Luận với Maximinus, Giám Mục Phái Ariô',
  'Measure, Number, and Weight': 'Mức Độ, Con Số và Trọng Lượng',
  'Melania the Elder': 'Thánh Melania Cả',
  'Melania the Younger': 'Thánh Melania Trẻ',
  'Memory': 'Ký Ức',
  'Mendacio, De/Contra Mendacium': 'Về Sự Nói Dối và Chống Sự Nói Dối',
  'Mercy, Works of Mercy': 'Lòng Thương Xót và Các Việc Thương Người',
  'Middle Way': 'Con Đường Trung Dung',
  'Milevius, Council of': 'Công Đồng Milevis',
  'Milleloquium Sancti Augustini': 'Tuyển Tập Ngàn Lời của Thánh Augustinô',
  'Mind': 'Tâm Trí',
  'Ministry': 'Thừa Tác Vụ',
  'Monasticism': 'Đời Đan Tu',
  'Monnica': 'Thánh Mônica',
  'Moribus ecclesiae Catholicae et de moribus Manicheorum, De': 'Về Phong Hóa của Hội Thánh Công Giáo và của Phái Manikê',
  'Music, Rhythm': 'Âm Nhạc và Nhịp Điệu',
  'Mysticism': 'Thần Nghiệm',
  'Natural Law': 'Luật Tự Nhiên',
  'Natural Place': 'Nơi Chốn Tự Nhiên',
  'Nature': 'Bản Tính',
  'Neoplatonism': 'Thuyết Tân Platon',
  'Novatian, Novatianism': 'Novatianus và Phái Novatianus',
  'Optatus of Milevis': 'Thánh Optatus thành Milevis',
  'Order': 'Trật Tự',
  'Ordination, Orders': 'Truyền Chức và Chức Thánh',
  'Origen': 'Origenes',
  'Origenist Controversy': 'Cuộc Tranh Luận về Phái Origenes',
  'Original Sin': 'Tội Nguyên Tổ',
  'Origine animae et de sententia Jacobi, De': 'Về Nguồn Gốc Linh Hồn và Lời của Thánh Giacôbê',
  'Our Father': 'Kinh Lạy Cha',
  'Paul': 'Thánh Phaolô',
  'Pauline Commentaries in Augustine’s Time': 'Các Chú Giải Thư Phaolô Thời Thánh Augustinô',
  'Paulinus of Nola': 'Thánh Paulinus thành Nola',
  'Peace': 'Bình An',
  'Peccatorum meritis et remissione peccatorum et de baptismo parvulorum, De': 'Về Công Trạng và Ơn Tha Tội cùng Phép Rửa cho Trẻ Nhỏ',
  'Pelagius, Pelagianism': 'Pelagius và Phái Pelagiô',
  'Penance': 'Thống Hối',
  'Perfectione justitiae hominis, De': 'Về Sự Hoàn Thiện của Đức Công Chính nơi Con Người',
  'Peripatetics': 'Phái Tiêu Dao',
  'Perpetua and Felicity': 'Thánh Perpetua và Thánh Felicitas',
  'Person': 'Ngôi Vị và Nhân Vị',
  'Peter Lombard': 'Phêrô Lombardô',
  'Plato, Platonism': 'Platon và Thuyết Platon',
  'Plotinus, The Enneads': 'Plotinus và Bộ Enneads',
  'Political Augustinianism': 'Học Thuyết Chính Trị Augustinô',
  'Political Thought, Contemporary Influence of Augustine’s': 'Ảnh Hưởng Đương Đại của Tư Tưởng Chính Trị Thánh Augustinô',
  'Pondus': 'Trọng Lượng (Pondus)',
  'Possibility': 'Khả Thể',
  'Poverty': 'Đức Khó Nghèo',
  'Prayer': 'Cầu Nguyện',
  'Preaching': 'Rao Giảng',
  'Predestination': 'Tiền Định',
  'Praesentia Dei, De': 'Về Sự Hiện Diện của Thiên Chúa',
  'Pride': 'Kiêu Ngạo',
  'Priscillianistas, Contra': 'Chống Phái Priscillianus',
  'Prosper of Aquitaine': 'Thánh Prosper thành Aquitaine',
  'Providence': 'Quan Phòng',
  'Psalms': 'Thánh Vịnh',
  'Punishment': 'Hình Phạt',
  'Quaestiones expositae contra paganos numero sex': 'Sáu Vấn Đề Chống Người Ngoại Giáo',
  'Quantitate animae, De': 'Về Sự Cao Cả của Linh Hồn',
  'Rachel and Leah': 'Rachel và Leah',
  'Ratio, Reason, Rationalism': 'Ratio, Lý Trí và Duy Lý',
  'Reason': 'Lý Trí',
  'Redemption': 'Ơn Cứu Chuộc',
  'Reformation, Augustinianism in the': 'Tư Tưởng Augustinô trong Phong Trào Cải Cách',
  'Regula': 'Tu Luật',
  'Regula, Use after Augustine': 'Việc Sử Dụng Tu Luật sau Thánh Augustinô',
  'Religion': 'Tôn Giáo',
  'Renaissance Humanism': 'Chủ Nghĩa Nhân Văn Phục Hưng',
  'Renaissance to the Enlightenment': 'Từ Phục Hưng đến Khai Sáng',
  'Resurrection': 'Phục Sinh',
  'Retractationes': 'Đính Chính',
  'Revelation': 'Mạc Khải',
  'Rhetoric': 'Tu Từ Học',
  'Roman Bishops': 'Các Giám Mục Rôma',
  'Roman Laws': 'Luật Rôma',
  'Roman Legal System': 'Hệ Thống Pháp Luật Rôma',
  'Romans, Letter to the': 'Thư Gửi Tín Hữu Rôma',
  'Royal Way': 'Con Đường Vương Giả',
  'Rule': 'Tu Luật',
  'Rules, Monastic': 'Các Tu Luật Đan Tu',
  'Sacraments': 'Các Bí Tích',
  'Saints': 'Các Thánh',
  'Satan': 'Satan',
  'Scholasticism, Early': 'Kinh Viện Sơ Kỳ',
  'Scholasticism, Late': 'Kinh Viện Hậu Kỳ',
  'Scripture': 'Kinh Thánh',
  'Seek–Find': 'Tìm Kiếm và Gặp Thấy',
  'Self-Defense': 'Tự Vệ',
  'Semi-Pelagianism': 'Thuyết Bán Pelagiô',
  'Sense Perception': 'Tri Giác Giác Quan',
  'Senses, Spiritual': 'Các Giác Quan Thiêng Liêng',
  'Sentientia Jacobi, De': 'Về Lời của Thánh Giacôbê',
  'Sibylline Oracles': 'Các Sấm Ngôn Sibyl',
  'Sign': 'Dấu Chỉ',
  'Simplicianus, Bishop of Milan': 'Simplicianus, Giám Mục Milan',
  'Sin': 'Tội Lỗi',
  'Skeptics, Skepticism': 'Phái Hoài Nghi và Thuyết Hoài Nghi',
  'Society, Social Thought': 'Xã Hội và Tư Tưởng Xã Hội',
  'Soul': 'Linh Hồn',
  'Spiritual Being': 'Hữu Thể Thiêng Liêng',
  'Spirituality': 'Linh Đạo',
  'Stoics, Stoicism': 'Phái Khắc Kỷ và Chủ Nghĩa Khắc Kỷ',
  'Suicide': 'Tự Sát',
  'Thagaste (Souk-Ahras)': 'Thagaste (Souk-Ahras)',
  'The Cappadocians': 'Các Giáo Phụ Cappadocia',
  'Theology, Modern': 'Thần Học Hiện Đại',
  'Theurgy': 'Pháp Thuật Thần Linh',
  'Thomas Aquinas': 'Thánh Tôma Aquinô',
  'Timasius and Jacobus': 'Timasius và Jacobus',
  'Time': 'Thời Gian',
  'Timor mortis': 'Nỗi Sợ Sự Chết',
  'Tradition': 'Thánh Truyền',
  'Traducianism': 'Thuyết Truyền Sinh',
  'Trent, Council of': 'Công Đồng Trentô',
  'Truth, Truths': 'Chân Lý và Các Chân Lý',
  'Typology': 'Kiểu Mẫu Học',
  'Unitate ecclesiae, De': 'Về Sự Hiệp Nhất của Hội Thánh',
  'Uti/frui': 'Sử Dụng và Hưởng Dùng (Uti/Frui)',
  'Utilitate jejunii, De': 'Về Ích Lợi của Việc Ăn Chay',
  'Vandals': 'Người Vandal',
  'Velatio': 'Việc Che Khăn',
  'Victorines': 'Trường Phái Saint-Victor',
  'Vincent of Lérins': 'Thánh Vincent thành Lérins',
  'Virtue': 'Nhân Đức',
  'Vision': 'Thị Kiến',
  'Versus de s. Nabaoth': 'Các Câu Thơ về Thánh Nabor',
  'War': 'Chiến Tranh',
  'Wealth': 'Của Cải',
  'Will': 'Ý Chí',
  'Wisdom': 'Đức Khôn Ngoan',
  'Women': 'Phụ Nữ',
  'Word': 'Ngôi Lời',
  'World': 'Thế Gian',
  'Worship, Christian': 'Phụng Tự Kitô Giáo',
};

const parseExistingWorkTranslations = () => {
  const source = fs.readFileSync(augustinePagePath, 'utf8');
  const worksBlock = source.match(/const WORKS:[\s\S]*?=\s*\[([\s\S]*?)\];\s*\/\/ Bản dịch tạm/)?.[1] ?? '';
  const translationsBlock = source.match(/const WORK_TITLE_VI:[\s\S]*?=\s*\{([\s\S]*?)\};\s*const WORK_PL_FROM_SOURCE/)?.[1] ?? '';
  const viByAbbreviation = new Map();
  const translationPattern = /'((?:\\'|[^'])+)'\s*:\s*'((?:\\'|[^'])*)'/g;

  for (const match of translationsBlock.matchAll(translationPattern)) {
    viByAbbreviation.set(match[1].replaceAll("\\'", "'"), match[2].replaceAll("\\'", "'"));
  }

  const translatedTitles = new Map();
  const workPattern = /\{[^\n]*?abbr:\s*'((?:\\'|[^'])+)'[^\n]*?latin:\s*'((?:\\'|[^'])+)'[^\n]*?english:\s*'((?:\\'|[^'])+)'[^\n]*?\}/g;
  for (const match of worksBlock.matchAll(workPattern)) {
    const abbreviation = match[1].replaceAll("\\'", "'");
    const latin = match[2].replaceAll("\\'", "'");
    const english = match[3].replaceAll("\\'", "'");
    const vietnamese = viByAbbreviation.get(abbreviation);
    if (!vietnamese) continue;
    translatedTitles.set(normalize(latin.replace(/\s*\[lost\]\s*/i, '')), vietnamese.replace(/\s*\[thất lạc\]\s*/i, ''));
    translatedTitles.set(normalize(english.replace(/\s*\[lost\]\s*/i, '')), vietnamese.replace(/\s*\[thất lạc\]\s*/i, ''));
  }
  return translatedTitles;
};

const workTranslations = parseExistingWorkTranslations();
const files = fs.readdirSync(contentDir).filter((file) => file.endsWith('.md'));
const refreshTemporary = process.argv.includes('--refresh-temporary');
const unchanged = [];
let updated = 0;
let preserved = 0;

for (const file of files) {
  const target = path.join(contentDir, file);
  const source = fs.readFileSync(target, 'utf8');
  const title = source.match(/^title:\s*"([\s\S]*?)"\s*$/m)?.[1] ?? '';
  const current = source.match(/^titleVi:\s*"([\s\S]*?)"\s*$/m)?.[1] ?? '';
  if (!title) throw new Error(`Thiếu title trong ${file}`);
  if (current && !(refreshTemporary && current === title)) {
    preserved += 1;
    continue;
  }

  const reordered = reorderLatinTitle(title);
  const vietnamese =
    direct[title]
    ?? workTranslations.get(normalize(title))
    ?? workTranslations.get(normalize(reordered))
    ?? title;

  if (vietnamese === current) {
    preserved += 1;
    if (vietnamese === title) unchanged.push(title);
    continue;
  }

  if (vietnamese === title) unchanged.push(title);
  const escaped = vietnamese.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const next = source.replace(/^titleVi:\s*"[\s\S]*?"\s*$/m, `titleVi: "${escaped}"`);
  if (next === source) throw new Error(`Không cập nhật được titleVi trong ${file}`);
  fs.writeFileSync(target, next, 'utf8');
  updated += 1;
}

console.log(JSON.stringify({
  total: files.length,
  updated,
  preserved,
  unchangedProperNamesOrLatinTitles: unchanged.length,
  unchanged,
}, null, 2));
