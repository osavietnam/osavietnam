# Hướng Dẫn Soạn Bài

Dành cho người soạn nội dung. Không cần biết lập trình.

## A. Một bài viết trông như thế nào

Mỗi bài là một file `.md`. Phần đầu (giữa hai dòng `---`) là **thông tin bài**,
phần dưới là **nội dung**.

```markdown
---
title: "Bản Chất Của Lời Cầu Nguyện"
author: "Ban Biên Tập"
category: "Thần Học"
date: 2025-08-15
excerpt: "Câu tóm tắt hiện ở thẻ bài ngoài trang chủ."
image: "../../../assets/anh-thumbnail.webp"
featured: true
---

## Chương I: Tiêu đề chương

Đoạn văn bình thường. Muốn *in nghiêng* thì để dấu sao hai bên.

> Đây là một câu trích dẫn.
>
> — Tên tác giả

Đoạn tiếp theo, có [liên kết tới sách](/sach/st-augustine/tu-thuat/).
```

## B. Các ký hiệu định dạng

| Muốn | Gõ |
|---|---|
| *In nghiêng* | `*chữ*` |
| **In đậm** | `**chữ**` |
| Tiêu đề chương | `## Tên chương` |
| Tiêu đề mục nhỏ | `### Tên mục` |
| Xuống dòng trong cùng đoạn | thêm hai dấu cách ở cuối dòng |
| Trích dẫn | `> Câu trích` rồi dòng `> — Tác giả` |
| Chèn ảnh | `![mô tả](/images/ten-anh.jpg)` |
| Liên kết | `[chữ hiển thị](/đường-dẫn/)` |
| Chú thích | `...nội dung[^1]` và cuối bài `[^1]: Lời chú thích.` |
| Bảng | dùng dấu `\|` (xem ví dụ bên dưới) |

Bảng:

```markdown
| Cột 1 | Cột 2 |
| --- | --- |
| A | B |
| C | D |
```

Tiêu đề `##` sẽ **tự động** tạo mục lục bên trái khi bài đủ dài.

## C. Thông tin bài (frontmatter)

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `title` | ✅ | Tiêu đề |
| `category` | nên có | "Thần Học" / "Triết Học" / "Linh Đạo" |
| `author` | | Tác giả |
| `date` | | Ngày đăng, dạng `YYYY-MM-DD` |
| `excerpt` | | Tóm tắt hiện ở thẻ bài |
| `image` | | Ảnh thu nhỏ |
| `heroImage` | | Ảnh lớn đầu bài |
| `featured` | | `true` để lên mục "Nổi bật" |
| `draft` | | `true` để lưu nháp, chưa hiện |

Với **sách**, thêm: `subtitle` (tên gốc), `translator`, `bookType`
(`spiritual` hoặc `philosophy`), `publishYear`, `order` (thứ tự trong danh sách
tác giả).

## D. Đặt file ở đâu

- Bài thần học → `src/content/bai-viet/than-hoc/ten-bai.md`
- Bài triết học → `src/content/bai-viet/triet-hoc/ten-bai.md`
- Sách → `src/content/sach/<tên-tác-giả>/ten-sach.md`

Tên file chính là đường dẫn URL, nên viết liền, không dấu, dùng gạch nối:
`cau-nguyen.md` → `/bai-viet/than-hoc/cau-nguyen/`.

## E. Soạn qua giao diện (không đụng file)

Vào địa chỉ `/admin/` của trang, đăng nhập, rồi điền form. Đây là cách dễ nhất —
bạn chỉ thấy các ô để điền và một trình soạn thảo có nút bấm, không thấy file
Markdown nào cả.

---

## F. (Kỹ thuật) Chuyển dữ liệu JSON cũ sang Markdown

Một file:

```bash
node scripts/convert-json-to-md.mjs \
  "db/bai-viet/than-hoc/articles/cau-nguyen.json" \
  "src/content/bai-viet/than-hoc/cau-nguyen.md" \
  --type=article --title="..." --author="..." --category="Thần Học" --date=2025-08-15
```

Hàng loạt (đọc index.json để lấy tiêu đề/tác giả rồi lặp): có thể viết thêm một
vòng lặp shell hoặc một script Node đọc `index.json`, gọi `convert-json-to-md.mjs`
cho từng `contentFile`. Script đã tự chuyển: `*nghiêng*`, `||` (xuống dòng),
`[[quote|...]]`, `[[image|...]]`, `[[Text|đích]]` (liên kết nội bộ), `[^1]`
(chú thích) và bảng — sang Markdown chuẩn.
