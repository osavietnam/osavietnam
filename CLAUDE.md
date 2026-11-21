# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AUGUSINH — Hướng dẫn cho Claude Code

Thư viện số Công giáo (Thánh Augustinô + Dòng Augustinô), tiếng Việt.
Trả lời và viết commit/giải thích bằng **tiếng Việt**.

## Stack
- **Astro 5** + Markdown/MDX, nội dung qua Content Collections.
- Không dùng framework UI nặng. CSS thuần (không Tailwind trong source — thiết kế
  Tailwind nếu có chỉ là mockup, phải dịch sang CSS thuần).
- Node ^22.12 hoặc ^24.

## Lệnh
- `npm run dev` — server hot-reload tại `localhost:4321` (để chạy liên tục khi sửa).
- `npm run build` — chỉ khi cần xuất bản thật (≈ 644 trang, ~10s). Xuất ra `dist/`.
- `npm run preview` — xem bản build tĩnh tại local trước khi deploy.
- `npm run admin` — server API CRUD Kinh Sách tại `localhost:4322` (`scripts/admin-server.mjs`),
  dùng kèm trang `/admin` (chạy song song với `npm run dev`). Xem mục CMS bên dưới.
- `npm install` — CHỈ chạy khi `package.json` đổi. Đừng chạy thừa.
- Sau khi sửa, ưu tiên kiểm tra bằng dev server; chỉ `npm run build` khi cần chắc chắn.
- **Chưa có test runner** (`npm test` chỉ là placeholder). "Kiểm tra" = build sạch + xem dev server.

## Cấu trúc
```
src/
  content.config.ts        # 7 collection: 'bai-viet', 'sach', 'kinh-sach',
                           #               'thanh-chan-phuoc', 'documents',
                           #               'tu-thuat', 'lich-su-dong'
  content/
    bai-viet/<than-hoc|triet-hoc>/*.md
    sach/<tác-giả>/*.md
    kinh-sach/<mùa>/*.md     # 626 bài, 8 mùa phụng vụ
    thanh-chan-phuoc/*.md    # tiểu sử thánh/chân phước (có lịch lễ)
    documents/*.md           # văn kiện song ngữ vi/en (tu-luat, hien-chuong, ratio…)
    tu-thuat/*.md            # 13 quyển + bio Tự Thuật Thánh Augustinô
    lich-su-dong/**/*.md     # lịch sử dòng Augustinô
  data/kinh-sach-index.json  # bảng index Kinh Sách — do script sinh, KHÔNG sửa tay
  pages/
    index.astro
    bai-viet/index.astro              # danh sách bài viết (một trang gộp, lọc theo chuyên mục)
    bai-viet/[...slug].astro          # trang đọc bài viết
    sach/[type]/index.astro           # danh sách sách theo loại
    sach/[...slug].astro              # trang đọc sách
    thanh-chan-phuoc/index.astro      # danh sách + [slug].astro trang tiểu sử
    thanh-au-tinh/index.astro         # tiểu sử chuyên sâu Thánh Augustinô (timeline + Tự Thuật)
    on-goi/index.astro                # trang Ơn Gọi (full-bleed slider banner)
    lich-su-dong/index.astro          # lịch sử dòng (tab + content tĩnh)
    tu-luat|hien-chuong|ratio/{index,en}.astro  # văn kiện song ngữ (DocumentReader)
    documents/fragment/[id].astro     # fragment endpoint cho DocumentReader lazy-load
    thu-vien/index.astro              # trang thư viện
    kinh-sach/index.astro             # bảng index + tab mùa + tìm/lọc
    kinh-sach/[...slug].astro         # trang đọc
    tu-thuat.astro                    # trang đọc Tự Thuật (tabs per quyển, lazy fragment)
    tu-thuat/fragment/[slug].astro    # fragment endpoint cho mỗi quyển
    lich-phung-vu.astro               # lịch phụng vụ (đọc public/data/calendar)
    admin.astro                       # UI quản lý Kinh Sách (gọi admin-server)
    [...comingsoon].astro             # trang tạm cho mục chưa migrate
  layouts/BaseLayout.astro   # nạp CSS theo thứ tự; banner; SEO; nút lên đầu
  components/                # Navbar, Footer, Banner, ArticleCard, TableOfContents
  lib/banners.ts             # cấu hình banner từng trang (object BANNERS)
  styles/                    # xem mục CSS bên dưới
scripts/
  convert-json-to-md.mjs     # JSON bài viết/sách -> Markdown (có footnote)
  convert-kinh-sach.mjs      # JSON Kinh Sách -> Markdown + sinh index.json
  convert-documents.mjs      # JSON -> collection 'documents' (văn kiện song ngữ)
  admin-server.mjs           # API CRUD Kinh Sách (npm run admin, port 4322)
  gen_calendar.py            # thuật toán tính lịch phụng vụ (Python)
  gen_all_calendars.py       # sinh public/data/calendar/{year}.json 2020-2100
public/admin/                # Decap CMS — giao diện soạn bài tại /admin/ (khi deploy)
public/data/calendar/        # JSON lịch phụng vụ theo năm (do script Python sinh)
```

## Content Collections — Frontmatter

**`bai-viet`** (`src/content/bai-viet/<than-hoc|triet-hoc>/*.md`):
```yaml
title: ""          # bắt buộc (mọi field khác optional)
subtitle: ""
author: ""
category: ""       # "Thần Học" | "Triết Học" | ...
date: 2025-08-15   # z.coerce.date, optional
excerpt: ""
image: ../../../assets/...  # tối ưu qua Astro
heroImage: ../../../assets/...  # ảnh hero (optional)
tags: []           # mảng chuỗi, mặc định []
featured: false    # true → lên "Nổi bật" trang chủ
draft: false       # true → ẩn khỏi mọi trang
```

**`sach`** (`src/content/sach/<tac-gia>/*.md`):
```yaml
title: ""
subtitle: ""       # tên nguyên bản
author: ""
translator: ""
excerpt: ""        # mô tả ngắn
bookType: "spiritual"   # "spiritual" | "philosophy" | "tu-thuat"
publishYear: ""    # chuỗi
featured: false
order: 1           # thứ tự trong danh sách tác giả
draft: false
```

**`kinh-sach`** (`src/content/kinh-sach/<season-key>/*.md`):
```yaml
title: ""
season: "Mùa Giáng Sinh"   # nhãn hiển thị
seasonKey: "mua-giang-sinh" # phải khớp tên thư mục
source: ""         # nguồn trích dẫn
excerpt: ""
liturgy: ""        # tên bài lễ (hiện trong bảng index)
rank: ""
order: 1
draft: false
```

8 `seasonKey` hợp lệ: `le-chung`, `le-rieng`, `trong-kinh-chua`, `mua-thuong-nien`,
`mua-vong`, `mua-giang-sinh`, `mua-chay`, `mua-phuc-sinh`.

**`thanh-chan-phuoc`** (`src/content/thanh-chan-phuoc/*.md`) — tiểu sử thánh/chân phước:
```yaml
title: ""
subtitle: ""
rank: "none"       # "solemn" | "feast" | "memorial" | "none"
feastDay: 28       # ngày lễ (số)
feastMonth: 8      # tháng lễ (số)
imageFile: ""      # tên file ảnh
manualFill: false  # true → bài do người soạn điền thủ công (không auto-generate)
draft: false
```

**`tu-thuat`** (`src/content/tu-thuat/*.md`) — Tự Thuật Thánh Augustinô (Confessiones):
```yaml
title: ""          # bắt buộc
order: 0           # bio.md dùng order: 0; 13 quyển dùng order: 1–13
draft: false
```
Có 1 entry `bio.md` (`order: 0`, tiểu sử tác giả) và 13 quyển được đánh số `order: 1–13`.

**`lich-su-dong`** (`src/content/lich-su-dong/**/*.md`) — lịch sử dòng Augustinô:
```yaml
title: ""
subtitle: ""       # optional
sourceNote: ""     # nguồn tài liệu
period: ""         # giai đoạn lịch sử
order: 1
excerpt: ""
draft: false
```

**`documents`** (`src/content/documents/*.md`) — văn kiện song ngữ (tu-luat, hien-chuong, ratio…):
```yaml
title: ""
subtitle: ""
docType: ""
lang: "vi"         # "vi" | "en" — mỗi ngôn ngữ một entry (id vd: ratio-vi, ratio-en)
translator: ""
translatorNote: ""
draft: false
```
Trang văn kiện dùng component `DocumentReader.astro`; route (vd `/ratio/`, `/ratio/en/`)
gọi `getEntry('documents', 'ratio-vi')` và truyền danh sách `langs` để chuyển ngôn ngữ.

## Routing

- URL của bài viết = `/bai-viet/<entry.id>/` — `entry.id` bao gồm thư mục con,
  ví dụ `than-hoc/cau-nguyen` → `/bai-viet/than-hoc/cau-nguyen/`.
- URL sách = `/sach/<entry.id>/` (tương tự).
- URL Kinh Sách = `/kinh-sach/<entry.id>/` — slug là toàn bộ `entry.id`.
- Tên file `.md` chính là slug, nên viết liền-không-dấu-gạch-nối.

## BaseLayout — props

```astro
<BaseLayout title="..." banner="readings" description="..." image="/og.jpg" type="article" bodyClass="has-sidebar">
```

| Prop | Mặc định | Ghi chú |
|---|---|---|
| `title` | (bắt buộc) | Ghép thành `OSA Việt Nam \| {title}` (mặc định `OSA Việt Nam \| Trang Chủ`) |
| `banner` | `null` | Key trong `BANNERS` hoặc `null` để ẩn banner |
| `description` | chuỗi mô tả site | Dùng cho `<meta description>` và OG |
| `image` | — | URL ảnh cho OG (`og:image`) |
| `type` | `"website"` | `"article"` cho bài viết (ảnh hưởng JSON-LD) |
| `bodyClass` | `"no-sidebar"` | Class trên `<body>` |

`banner` nhận **key string** từ `src/data/banners.json` (nguồn thật) — `BANNERS` trong
`src/lib/banners.ts` chỉ đọc và build HTML từ file đó.
Keys hiện có: `home`, `bai-viet-triet-hoc`, `bai-viet-than-hoc`, `readings`, `reader`,
`saints`, `documents`, `tu-luat`, `thu-vien`, `lich-phung-vu`, `tu-thuat`,
`lich-su-dong`, `thanh-au-tinh`. KHÔNG truyền đường dẫn ảnh trực tiếp.

Để thêm banner mới: thêm entry vào `src/data/banners.json` (hoặc qua tab Cài Đặt Trang
tại `/admin`), ảnh đặt trong `public/images/banners/`.

**`slot="full-bleed"`**: BaseLayout có slot này để đặt nội dung ngoài `main.content`
(full-width, không bị padding/max-width của layout). Dùng cho banner kiểu slider như
trang `/on-goi/`. Thêm `<div slot="full-bleed" ...>` bên trong `<BaseLayout>`.

## QUY TẮC CSS (quan trọng — luôn tuân thủ)
1. **Mọi thay đổi CSS phải đồng bộ toàn site**, không chỉ vá một trang.
2. **Hạn chế tối đa `!important`.** Hiện chỉ còn 4 chỗ ở navbar (đè transition gốc).
   `reader.css` đã 0 `!important`. Khi cần thắng CSS gốc, dùng thứ tự nạp +
   đặc hiệu tương đương, đừng thêm `!important`.
3. **`overrides.css` nạp SAU CÙNG** và là nơi đặt mọi quy tắc đồng bộ toàn site
   (màu nền, card, typography, footer, màu chữ). Sửa đồng bộ thì sửa ở đây.
4. Biến màu/font gom ở đầu `overrides.css` (`:root`). Đổi tông chỉ sửa một chỗ.
5. **`[data-theme="light"]` override BẮT BUỘC phải đặt trong `overrides.css`**, không
   bao giờ viết trong `<style is:global>` của page. Lý do: Astro bundle page styles
   *trước* overrides.css → rule trong page thua ở cascade dù specificity bằng nhau.
6. **Mỗi CSS variable phải defined ở CẢ HAI mode** (`:root` dark default +
   `[data-theme="light"]` override). Hiện có: `--accent`, `--accent-deep`,
   `--border-light/subtle/accent` — tất cả defined trong cả hai mode. Khi thêm
   variable mới, luôn thêm cả hai. Element dùng variable tự switch — không cần
   override riêng cho từng element.
7. **Quy trình khi muốn element trông khác nhau giữa hai mode:**
   - Nếu chỉ khác màu → dùng semantic variable (đã switch sẵn), không viết override.
   - Nếu layout/design thực sự khác (vd white card trong light) → viết override trong
     `overrides.css`, không trong page style.

### Thứ tự nạp CSS trong BaseLayout (không đổi thứ tự tùy tiện)
base → layout → components → home-layout → nav-mobile → listings → articles →
reader → **overrides (cuối cùng)**.

⚠️ Chỉ 9 file trên được `BaseLayout` import. Các file còn lại trong `styles/`
(`articles-mobile.css`, `encyclopedia-mobile.css`, `home-mobile.css`,
`kinh-sach-mobile.css`, `loi-chua-mobile.css`, `reader-mobile.css`,
`saints-mobile.css`, `static-doc-mobile.css`, `archives.css`, `nien-bieu.css`)
**hiện KHÔNG được nạp ở đâu cả** — responsive thực tế nằm trong `@media` của
các file đang nạp. Nếu cần một file mobile đó, phải tự `import` vào
BaseLayout/trang; đừng giả định nó đang chạy.

### Design tokens (biến trong `overrides.css`)
- Nền chính: `#101b33`  (--bg-main)
- Nền thẻ: `#16223d`  (--bg-card) — vùng ảnh thẻ `#1f2942` (--bg-card-img)
- Nền footer: `#0c1426`  (--bg-footer)
- Vàng nhấn: `#e9c176`  (--gold), dim `#c5a059`
- Chữ chính (kem): `#efe7d6`  (--ink-cream)
- Chữ phụ/mờ (kem): `#c9bfa9`  (--ink-cream-soft)
- KHÔNG dùng lại tông xanh xám lạnh cũ `#cdd6df`, `#8b97a1`.

### Font
- Tiêu đề (h1–h5, card title): **Noto Serif** (fallback Playfair Display).
- Thân bài + quote banner: **Merriweather**.
- Nav items (menu chính, dropdown): **Manrope** (weight 500, letter-spacing 0.045rem).
- Nhãn UI (badge, author, pagination, toolbar label): **Be Vietnam Pro**.
- Riêng tiêu đề site "AUGUSINH": **Playfair Display**.
- Icon: dùng **inline SVG**, KHÔNG phụ thuộc font icon (Material Symbols).

### Card chuẩn (áp cho .a-card, .article-card, .book-card)
Nền `--bg-card`, viền `rgba(233,193,118,0.2)`, bo góc 14px, hover: halo glow +
nâng `translateY(-3px)`. Tiêu đề gold Noto Serif. Badge có viền. Lưới tối đa 3 cột,
gap 3.2rem, max-width 120rem. Trang chủ và trang Bài Viết phải DÙNG CÙNG kích thước.

## Nội dung & converter
- Thêm bài viết/sách: tạo `.md` trong `content/...` với frontmatter phù hợp (xem trên),
  hoặc chuyển từ JSON gốc bằng `scripts/convert-json-to-md.mjs`.
- **Footnote**: JSON gốc lưu trong object `footnotes` theo từng section; converter
  đánh số toàn cục và sinh `[^n]: …` ở cuối bài. Đừng để rò `[^1]` literal.
- **Kinh Sách**: sửa dữ liệu thì chạy lại `convert-kinh-sach.mjs` để cập nhật cả
  `.md` lẫn `data/kinh-sach-index.json`. Làm sạch thẻ `<br>` rò trong index.
  `kinh-sach-index.json` do script sinh — KHÔNG sửa tay.

## Hai đường soạn bài (CMS) — đừng nhầm lẫn
1. **Decap CMS** tại `/admin/` (`public/admin/config.yml` + `index.html`): chạy trên
   bản deploy, backend Git (git-gateway/GitHub), người soạn điền form → commit `.md`.
   Dùng khi xuất bản thật.
2. **Admin nội bộ** khi dev: `npm run admin` mở API ở `localhost:4322`
   (`scripts/admin-server.mjs`) + trang `/admin` (port 4321). CRUD trực tiếp file
   `.md` trong `src/content/kinh-sach/`, **tự rebuild `src/data/kinh-sach-index.json`**
   sau mỗi thao tác. Dev server hot-reload theo. Đây là cách sửa Kinh Sách nhanh
   thay cho chạy tay `convert-kinh-sach.mjs`.

## Lịch Phụng Vụ (ĐÃ migrate — không còn là "chưa tái hiện")
- Trang `/lich-phung-vu` (`src/pages/lich-phung-vu.astro`) hiển thị lịch Giờ Kinh
  Phụng Vụ, tính mùa/chu kỳ theo ngày bằng JS.
- Dữ liệu: `public/data/calendar/{year}.json` (mỗi file 1 năm phụng vụ 2020–2100),
  sinh bằng **Python**: `scripts/gen_all_calendars.py` (gọi `gen_calendar.py`).
  Sửa thuật toán lịch → chạy lại script Python để sinh lại JSON.

## Hành vi UX đã chốt (giữ nguyên khi sửa)
- Banner nằm dưới navbar, cấu hình theo trang trong `lib/banners.ts`.
- Trang Kinh Sách: tab mùa (pill) + ô tìm + lọc tác giả + **bảng index 3 cột**
  (Tác Giả | Trích Đoạn | Bài Lễ), đồng bộ URL `?category=&author=`, Back/Forward
  khôi phục đúng mùa.
- Trang đọc Kinh Sách: tự cuộn xuống tiêu đề bài (bỏ qua banner) khi hiển thị,
  kể cả Back/Forward (dùng `history.scrollRestoration='manual'`).
- Trang Bài Viết: hero + toolbar (tìm/chuyên mục/tác giả) + lưới card + phân trang
  9 bài/trang + đếm kết quả + trạng thái rỗng.
- Navbar nền đặc `#101b33` (không trong suốt).

## Khi deploy thật
- Đổi `site:` trong `astro.config.mjs` thành domain thật (hiện là placeholder
  `https://augusinh.example.com` — cần đúng cho SEO/sitemap).
- Cấu hình xác thực Decap CMS theo hosting (Netlify Identity hoặc GitHub backend).

## Mục ĐÃ migrate (có route thật)
- **Lịch phụng vụ** — `/lich-phung-vu` (xem mục Lịch Phụng Vụ ở trên).
- **tu-luat, hien-chuong, ratio** — văn kiện song ngữ qua collection `documents` +
  `DocumentReader.astro`, mỗi mục có `/…/` (vi) và `/…/en/`.
- **thanh-chan-phuoc** — `/thanh-chan-phuoc/` (danh sách) + `/thanh-chan-phuoc/<slug>/`.
- **thu-vien** — `/thu-vien/`.
- **on-goi** — `/on-goi/` — trang Ơn Gọi, dùng `slot="full-bleed"` và slider banner.
- **lich-su-dong** — `/lich-su-dong/` — lịch sử dòng, dùng collection `lich-su-dong`.
- **thanh-au-tinh** — `/thanh-au-tinh/` — trang tiểu sử Thánh Augustinô kết hợp
  timeline và render entry `st-augustine-of-hippo` từ collection `thanh-chan-phuoc`.
- **tu-thuat** (sách) — `/tu-thuat` — trang đọc Tự Thuật (`src/pages/tu-thuat.astro`)
  dùng collection `tu-thuat`, lazy-load từng quyển qua fragment endpoint.
  URL cũ `/sach/st-augustine/tu-thuat` được redirect về `/tu-thuat` (khai báo trong `astro.config.mjs`).

## Mục CHƯA migrate (đang dùng trang tạm `[...comingsoon].astro`)
nien-bieu, linh-dao, luu-tru, encyclopedia, loi-chua-bai-giang. Khi migrate, tạo
route thật cùng tên → trang tạm tự được thay.

## Astro scoped CSS — quy tắc bắt buộc

`<style>` trong `.astro` mặc định **scoped**: Astro thêm `data-astro-cid-*` vào
element trong template, rồi biến CSS selector thành `.class[data-astro-cid-xxx]`.
Element tạo bằng JS (`innerHTML`, `insertAdjacentHTML`…) **không có** attribute này
→ styles không apply dù khai báo đúng.

**Giải pháp**: dùng `<style is:global>` khi trang có HTML động.  
Để tránh ảnh hưởng trang khác, bọc **tất cả** rules dưới wrapper class của trang:
```css
/* an toàn — chỉ ảnh hưởng bên trong .sb-wrap */
.sb-wrap .sb-entry-row { … }
```
Hoặc nếu rules đã đặt đúng dưới wrapper thì `is:global` là đủ (không cần prefix thêm).

Ví dụ cụ thể: `/admin` dùng `<style is:global>` vì entryList và cdPageList
đều render bằng JS. Tất cả rules được giới hạn dưới `.sb-wrap`.

## Admin nội bộ — data tĩnh

Banner và tiêu đề trang có thể chỉnh qua tab **Cài Đặt Trang** tại `/admin`
(cần `npm run admin` chạy song song):
- `src/data/banners.json` — banner config (imageUrl, quoteText, quoteCite) cho mọi trang.
- `src/data/page-headers.json` — masthead (title/sub/desc) cho các trang có PageHeader tĩnh.
- `src/lib/banners.ts` đọc `banners.json` và build HTML quote, export `BANNERS`.
- Trang dùng masthead đọc `page-headers.json` qua static import — dev HMR tự reload khi JSON đổi.

Admin server (`localhost:4322`) có thêm endpoint:
`GET/PUT /api/banners`, `GET/PUT /api/page-headers`, `GET /api/banner-images`.

## Thuộc tính kỹ thuật đặc biệt (BaseLayout tự xử lý)

- **`data-emblem`** trên `<img>`: BaseLayout JS tự swap `src` giữa `/images/emblem.svg`
  (dark) và `/images/emblem-color.jpg` (light) khi theme đổi. Dùng trên mọi icon emblem,
  không cần viết JS trong trang.

- **`data-no-autoscroll`** trên `<body>` (hoặc `document.body.dataset.noAutoscroll`):
  Khi được đặt, BaseLayout bỏ qua auto-scroll xuống `article-header`/`ks-masthead`.
  Dùng cho trang tự quản lý scroll như `/on-goi/`.
  Trong Astro: `<BaseLayout ... >` rồi trong `<script>` đặt
  `document.body.dataset.noAutoscroll = '1'`.

- **`data-banner-field`** và **`data-banner-vi`** trên elements trong Banner:
  Banner inline-edit (hiện trong thanh dưới cùng khi admin server chạy) dùng
  hai attribute này để nhận diện field cần lưu. Chỉ liên quan khi sửa
  component `Banner.astro`.

- **`data-oe-target` / `data-oe`**: Hệ thống inline-edit cho page header —
  `data-oe-target="ph"` chỉ loại target (page-header), `data-oe="eyebrow"` chỉ field.
  Dữ liệu lưu vào `src/data/page-headers.json` qua admin server.
  Key trong `page-headers.json` phải trùng với key trang (vd `"on-goi"`, `"lich-su-dong"`).

## Kiểm tra trước khi coi là xong
- `npm run build` chạy sạch, không lỗi.
- Không còn link nội bộ 404 (mọi mục navbar dẫn tới trang hợp lệ).
- CSS đổi đã đồng bộ toàn site, không phá trang khác.
- Không thêm `!important` mới trừ khi thật sự bắt buộc (giải thích lý do).
- Trang có HTML động → dùng `<style is:global>`, không dùng `<style>` thuần.
