# Deploy OSA Vietnam lên Hostinger

Website này dùng Astro SSR và Node.js để tải tin Trung ương Dòng/Tỉnh Dòng theo thời gian thực. Không deploy riêng thư mục `dist/client` như một website HTML tĩnh.

## Cấu hình khuyến nghị

- Loại website: **Web App**
- Framework: **Astro** (backend/full-stack)
- Domain: `osavietnam.org`
- Root directory: `/` nếu repository bắt đầu tại file `package.json`; nếu upload cả thư mục cha thì chọn `osavietnam`
- Node.js: **24.x** (Astro 7.4 yêu cầu Node >=22.23.4; dùng 24.x để tránh Hostinger cấp một bản 22.x quá cũ)
- Package manager: **npm**
- Install command: `npm ci`
- Build command: `npm run build`
- Entry file: `server/entry.mjs` (Hostinger tính đường dẫn này tương đối từ Output directory `dist`)
- Output directory (nếu giao diện bắt buộc nhập): `dist`

Không cần khai báo biến môi trường cho website public. Các biến `STUDIO_GITHUB_*` chỉ dành cho Content Studio chạy cục bộ và không nên đưa lên Hostinger.

## Cách deploy bằng GitHub (khuyến nghị)

1. Đưa mã nguồn lên repository GitHub/GitLab; không commit `.env`, `node_modules` hoặc `dist`.
2. Trong hPanel chọn **Websites → Create site → Web App**.
3. Gán domain `osavietnam.org`, rồi chọn **Import your Git repository**.
4. Nhập các thông số build ở trên và deploy.
5. Sau khi deploy, kiểm tra `/`, `/tin-tuc/`, `/api/central-news.html`, `/robots.txt` và `/sitemap-index.xml`.

Mỗi lần push lên nhánh đã kết nối, Hostinger có thể tự build và phát hành lại. Không sửa trực tiếp file trong `hbuilds/current`, vì lần deploy sau sẽ ghi đè.

## DNS và HTTPS

Nếu domain mua tại Hostinger, gán domain trong bước tạo Web App thường tự cấu hình DNS. Nếu domain quản lý ở nơi khác, dùng đúng A/AAAA/CNAME mà hPanel hiển thị cho website; không đoán địa chỉ IP. Chờ DNS cập nhật, bật SSL trong hPanel, rồi bật chuyển hướng HTTPS và chọn một hostname chuẩn (khuyến nghị `https://osavietnam.org`, chuyển hướng `www` về non-`www`).

## Kiểm tra sau deploy

```text
https://osavietnam.org/
https://osavietnam.org/tin-tuc/
https://osavietnam.org/api/central-news.html
https://osavietnam.org/api/province-news.html
https://osavietnam.org/robots.txt
https://osavietnam.org/sitemap-index.xml
```

Canonical URL và sitemap đã được cấu hình cho `https://osavietnam.org` trong `astro.config.mjs`.
