# AUGUSINH — bản migrate Astro (giữ nguyên thiết kế gốc)

Đây là bản dựng lại site AUGUSINH trên **Astro 5**, **giữ nguyên giao diện, màu sắc
và font của bản gốc**. Chỉ thực hiện 4 tối ưu hạ tầng:

1. **Xoá `_gen_scripts/` trùng lặp** — đã xoá 635 file (~3MB) nhân đôi trong
   `db/phung-vu/kinh-sach/_gen_scripts`.
2. **Bỏ lỗ hổng `innerHTML`** — không còn ghép chuỗi `innerHTML` từ dữ liệu như
   bản SPA cũ; Astro render ở thời điểm build và tự escape nội dung Markdown. Chỗ
   duy nhất dùng `set:html` là chuỗi tin cậy của site (footer, JSON-LD), không
   phải dữ liệu người dùng.
3. **Soạn bài bằng Markdown** + script chuyển JSON cũ sang Markdown.
4. **Astro + SEO meta** (Open Graph, Twitter, JSON-LD, sitemap) — thứ bản SPA cũ
   thiếu — và **Content Studio** để biên tập, preview và xuất bản qua GitHub.

Thiết kế (navy + gold, 4 font Be Vietnam Pro / Source Serif 4 / Playfair Display /
Montserrat) được tái sử dụng **nguyên bản** từ thư mục `css/` cũ.

## Banner & các mục đã có
- **Banner dưới menu** được khôi phục, cấu hình theo từng trang trong
  `src/lib/banners.ts` (giống `page-configs.json` gốc) — mỗi chuyên mục có ảnh +
  câu trích riêng.
- **Trang Kinh Sách** (`/kinh-sach/`) — nhóm bài đọc theo mùa phụng vụ.

## Bài mẫu đã chuyển đổi
- `bai-viet/triet-hoc/plato-hoc-thuyet-y-the` — bài triết học (ảnh, bảng)
- `bai-viet/than-hoc/cau-nguyen` — bài thần học (trích dẫn, chú thích, liên kết nội bộ)
- `sach/st-augustine/tu-thuat` — sách nhiều chương
- `kinh-sach/mua-giang-sinh/*`, `kinh-sach/mua-vong/*` — 3 bài Kinh Sách mẫu

## Chạy thử
```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # xuất ra dist/ (đã kiểm thử: 8 trang OK)
```
Yêu cầu Node ^22.12 hoặc ^24.

## Cấu trúc
```
src/
├── content/{bai-viet,sach}/   ← nội dung .md (thư mục con = chuyên mục / tác giả)
├── content.config.ts          ← định nghĩa 2 dạng bài + kiểm tra dữ liệu
├── layouts/BaseLayout.astro    ← khung trang + font gốc + SEO meta (mới)
├── components/                ← Navbar, Footer, ArticleCard, TableOfContents
├── pages/                    ← trang chủ, danh mục, trang đọc
└── styles/                   ← CSS GỐC (base/layout/components/nav-mobile) + reader.css
src/pages/admin.astro          ← giao diện Content Studio
scripts/admin-server.mjs       ← API biên tập local và GitHub adapter
scripts/convert-json-to-md.mjs ← chuyển JSON cũ → Markdown
```

## Soạn bài
Xem `HUONG-DAN-SOAN-BAI.md` và `docs/CONTENT-STUDIO.md`. Có thể dùng Content
Studio (`/admin/`), viết Markdown trực tiếp, hoặc chạy script chuyển hàng loạt từ
`db/` cũ.


## Kiểm tra toàn vẹn (đã chạy)
Bản này đã được kiểm tra kỹ từng trang:
- ✓ Không còn link nội bộ 404 — mọi mục trong navbar đều dẫn tới trang hợp lệ.
  Các mục chưa chuyển đổi (Niên Biểu, Tu Luật, Linh Đạo, Hiến Chương, Ratio,
  Thánh-Chân Phước, Lưu Trữ, Encyclopedia, Lời Chúa-Bài Giảng) hiện có **trang tạm**
  để điều hướng không gãy; khi tạo route thật cùng tên, trang tạm tự được thay.
- ✓ Mọi trang có đủ: banner dưới menu, nav-toggle (mobile), footer, nút lên đầu
  trang, 4 font gốc.
- ✓ Chức năng: bộ chọn Tác giả/Sách (trang Sách), nút mùa phụng vụ (Kinh Sách),
  mục lục dính lề (trang đọc sách), menu mobile — đều hoạt động.
- ✓ Ảnh emblem + banner tải đúng. Build sạch: 21 trang.

## Layout từng loại trang (so với bản gốc)
- **Trang chủ**: navbar + banner + “Bài Nổi Bật” + “Bài Mới Nhất” (card grid gốc).
  Lưu ý: phần “liturgy hôm nay / lịch phụng vụ” của bản gốc chạy bằng JS tính
  ngày — không thuộc phạm vi migrate Markdown, nên chưa tái hiện.
- **Danh sách bài viết**: banner riêng theo chuyên mục + tiêu đề + card grid.
- **Trang Sách**: welcome + bộ chọn Tác giả/Sách + grid theo tác giả — như gốc.
- **Kinh Sách**: welcome + hàng nút mùa + danh sách theo mùa — như gốc.
- **Trang đọc** (bài viết / sách / kinh sách): header + mục lục + thân Markdown.


## Trang Kinh Sách (đã hoàn thiện)
- **Chuyển đổi toàn bộ**: 626 bài đọc Kinh Sách (JSON → Markdown) qua
  `scripts/convert-kinh-sach.mjs` (đọc TableIndex.json gốc). Phân bố: Lễ Chung 27,
  Lễ Riêng 206, Lễ Trọng Kính Chúa 6, Thường Niên 238, Vọng 28, Giáng Sinh 21,
  Chay 52, Phục Sinh 48.
- **Khôi phục đầy đủ function gốc**: nút chọn 8 mùa → bảng (Tác Giả | Trích Đoạn |
  Bài Lễ) với ô tìm nhanh, lọc theo tác giả, nút Ẩn/Hiện Danh Mục, đồng bộ URL
  (?category=…&author=…) để chia sẻ/back được. Bấm dòng → mở bài đọc.
- Dữ liệu bảng nằm ở `src/data/kinh-sach-index.json` (do script sinh ra).



## Layout phần đọc (đã tối ưu)
- Cột chữ rộng 70rem, canh giữa; căn **trái** (tránh khoảng trắng loang lổ kiểu
  justify trong tiếng Việt); cỡ 1.8rem, line-height 1.85, màu kem ấm #f3ede1.
- Tiêu đề Merriweather đậm (700), giãn dòng hợp lý.

## Trang Kinh Sách — cuộn tới nội dung
Khi bấm một bài trong bảng danh mục, trang mở ra **tự cuộn xuống thẳng tiêu đề
bài** (bỏ qua banner trang trí) để vào đọc ngay. Mở link trực tiếp (không qua
bảng) thì giữ nguyên đầu trang. Có thêm link **"← Về danh mục <mùa>"** ở đầu mỗi
bài để quay lại đúng mùa đang xem.

## Cập nhật mới nhất
1. **Margin phần đọc**: cột rộng 74rem, canh giữa, padding hai bên gọn hơn — bớt
   khoảng trống thừa, vẫn giữ độ rộng dòng dễ đọc.
2. **Chú thích (footnotes)**: script chuyển đổi nay đọc đúng object `footnotes`
   theo từng section trong JSON gốc, đánh số toàn cục và sinh định nghĩa
   `[^n]: …` ở cuối bài → Astro render thành mục **"Chú thích"** có số, mũi tên
   quay lại, link hai chiều. (Trước đây hiện literal `[^1]`.)
3. **Cuộn tới nội dung**: trang đọc Kinh Sách luôn tự cuộn xuống tiêu đề bài (bỏ
   qua banner) mỗi khi hiển thị — kể cả khi bấm **Back/Forward**. Dùng
   `history.scrollRestoration='manual'` + `pageshow` để không bị trình duyệt kéo
   về chỗ cũ.
4. **Menu bar**: trả lại **Be Vietnam Pro** (tiêu đề "AUGUSINH" vẫn Playfair
   Display; body + heading nội dung vẫn Merriweather).
5. **Phân cấp tiêu đề** rõ ràng, dễ phân biệt:
   - h2 (chương/phần): Playfair Display, gold sáng, có gạch chân vàng
   - h3 (mục): Merriweather đậm, gold dịu, không trang trí
   - h4 (tiểu mục): Be Vietnam Pro IN HOA nhỏ, màu kem-vàng

## Thiết kế lại trang Kinh Sách & Sách (tối giản, dễ đọc)
Phần content của hai trang được dựng lại theo hướng simplicity + readable, giữ
tối đa function (styles ở `src/styles/listings.css`):

**Kinh Sách** — bỏ bảng 3 cột dày đặc, thay bằng:
- Tab mùa dạng "viên thuốc" (pill) gọn, bo tròn, dễ bấm.
- Thanh công cụ: ô tìm + dropdown lọc tác giả, bo góc mềm.
- Danh sách kiểu list dễ quét: mỗi bài là tiêu đề (bài lễ) đậm + dòng phụ
  (tác giả gold · trích đoạn in nghiêng). Có đếm số kết quả.
- Giữ nguyên function: chọn mùa, tìm, lọc tác giả, đồng bộ URL (?category=&author=),
  Back/Forward khôi phục đúng mùa, bấm dòng mở bài.

**Sách Thiêng Liêng / Triết Học** — cùng ngôn ngữ thiết kế:
- Tiêu đề + tagline, thanh tìm + lọc tác giả, đếm kết quả.
- Sách nhóm theo tác giả, mỗi cuốn dạng list-item (tên đậm + phụ đề + người dịch).
- Giữ function lọc/tìm theo tên sách & tác giả; bấm mở sách.

Cả hai responsive tốt trên mobile (tab tự xuống dòng, toolbar xếp dọc full-width).

## Thiết kế lại trang Danh Sách Bài Viết
Trang bài viết (`/bai-viet/<chuyên-mục>/`) được dựng lại theo mockup mới
(`src/styles/articles.css`), giữ trọn function:
- **Hero**: tiêu đề Noto Serif gold + đường fade + câu trích Thánh Augustinô.
- **Thanh tìm + lọc** trong khối bo góc có hiệu ứng halo: ô tìm (gạch chân),
  dropdown Chuyên Mục, dropdown Tác Giả — lọc trực tiếp.
- **Lưới thẻ 1/2/3 cột** responsive: ảnh (tối ưu sẵn qua Astro), badge chuyên mục,
  tiêu đề gold, tác giả · ngày, tóm tắt 3 dòng, "Đọc Thêm →", hiệu ứng hover
  (halo glow + ảnh phóng nhẹ + chữ phát sáng).
- **Phân trang** 9 bài/trang, nút số + chevron, tự cuộn lên đầu khi đổi trang.
- **Đếm kết quả** + trạng thái rỗng khi không khớp.
- Icon dùng **inline SVG** (không phụ thuộc font icon, luôn hiển thị).
Bảng màu/tfont theo mockup: navy #08122a + gold #e9c176, Noto Serif (tiêu đề) +
Manrope (nhãn/thân thẻ).

## Đồng bộ hoá toàn site (overrides.css)
Một file nạp sau cùng `src/styles/overrides.css` xử lý 5 việc đồng bộ:
1. **Background đồng bộ `#101b33`** ở mọi trang/khối (body, section, navbar).
2. **Navbar nền đặc** (bỏ trong suốt + bỏ blur) — không còn lẫn với nền khi cuộn,
   thêm viền + bóng nhẹ cho rõ.
3. **Chuẩn hoá card** theo style trang Bài Viết (.a-card): bo góc 14px, viền gold,
   tiêu đề gold Noto Serif, badge có viền, hover halo glow + nâng nhẹ — áp cho
   .article-card, .book-card và danh sách entry ở mọi trang.
4. **Màu chữ trắng kem**: thay #cdd6df → #efe7d6 (chữ chính), #8b97a1 → #c9bfa9
   (chữ phụ/mờ) — ấm hơn, bỏ tông xanh xám lạnh.
5. **Kinh Sách dùng bảng index giống bản gốc**: khôi phục bảng 3 cột
   (Tác Giả | Trích Đoạn | Bài Lễ) với header gold + chữ kem, vẫn giữ tab mùa +
   ô tìm + lọc tác giả + đồng bộ URL.
Muốn chỉnh tông màu/nền, sửa các biến ở đầu `overrides.css`.

## Đồng bộ hoá CSS toàn site (overrides.css)
Nguyên tắc làm việc: mọi thay đổi CSS đều can thiệp đồng bộ toàn trang, hạn chế
`!important` (chỉ còn 4 chỗ ở navbar để đè transition gốc; reader.css đã gỡ sạch
`!important`). Lần cập nhật này:
- **Typography đồng bộ** (h1..h5 + body): tiêu đề Noto Serif/Playfair, thân
  Merriweather, UI/nav Be Vietnam Pro — định nghĩa một chỗ.
- **Font quote banner** đổi sang **Merriweather** cho đồng bộ (trước là Montserrat).
- **Card trang chủ** dùng đúng kích thước lưới của trang Bài Viết (max 3 cột,
  gap 3.2rem, max-width 120rem) thay cho lưới nhỏ minmax(220px) cũ → đồng bộ.
- **main-footer** nền `#0c1426` (tối hơn nền content một bậc, cùng tông) + viền
  gold + chữ kem → liền mạch với nền, bỏ gradient lạc lõng.
Tất cả biến màu/font ở đầu `overrides.css`.

## Khi triển khai thật
- Đổi `site:` trong `astro.config.mjs` thành domain thật (cần cho SEO/sitemap).
- Chuyển nốt các mục còn lại (Saints, Phụng vụ, Encyclopedia, Niên biểu, các trang
  tĩnh tu-luat/linh-dao...) theo đúng mẫu collection + script đã có. Link navbar
  cho các mục này hiện trỏ tới route dự kiến, sẽ hoạt động khi chuyển nốt.
- Cấu hình token GitHub fine-grained và GitHub Actions deploy theo hướng dẫn Content Studio.
