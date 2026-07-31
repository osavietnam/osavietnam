# Deploy GitHub Pages — `osavietnam/osavietnam`

Bản này được cấu hình cho địa chỉ:

- Repository: `https://github.com/osavietnam/osavietnam`
- Website: `https://osavietnam.github.io/osavietnam/`
- Branch deploy: `main`
- Runtime build: Node.js `22.16.0`, npm `10.9.2`

## Đẩy source lên GitHub

```bash
git init
git branch -M main
git remote add origin https://github.com/osavietnam/osavietnam.git
git add .
git commit -m "Deploy OSA Vietnam site"
git push -u origin main
```

Nếu thư mục đã có remote `origin`, dùng:

```bash
git remote set-url origin https://github.com/osavietnam/osavietnam.git
```

## Bật GitHub Pages

Trong repository GitHub:

1. Mở **Settings → Pages**.
2. Ở **Build and deployment → Source**, chọn **GitHub Actions**.
3. Push vào branch `main`, hoặc mở tab **Actions** và chạy workflow thủ công.

Workflow `.github/workflows/deploy.yml` sẽ tự cài dependency bằng lockfile, build static, kiểm tra base path `/osavietnam`, kiểm tra link/asset nội bộ và deploy `dist/`.

## Chạy kiểm tra trên máy

```bash
npm ci
npm run build
npm run preview
```

Sau đó mở `http://localhost:4321/osavietnam/`.

## Các lệnh khác

```bash
npm run dev          # phát triển local bằng Node adapter, URL gốc /
npm run build:server # build bản Node server
npm run start        # build và chạy bản Node server
npm run audit:source # kiểm tra source không cần build
```

## Lưu ý chức năng trên GitHub Pages

GitHub Pages chỉ phục vụ file tĩnh. Các danh sách tin từ Trung Ương Dòng và Tỉnh Dòng được tải tại thời điểm build; bài nguồn mở sang website gốc vì Pages không thể chạy proxy server-side. Trang Admin nội bộ cần `npm run admin` trên máy và không thể ghi file trực tiếp trên GitHub Pages nếu chưa cấu hình một CMS/OAuth riêng.

## Fork hoặc đổi tên repo

Cấu hình tự đọc biến `GITHUB_REPOSITORY` trong GitHub Actions. Khi fork hoặc đổi tên repository, `site` và `base` sẽ tự đổi theo owner/repo mới. Chạy local vẫn mặc định dùng `osavietnam/osavietnam`; có thể ghi đè bằng:

```bash
GITHUB_REPOSITORY=owner/repo npm run build
```

## Cơ chế build staging

`npm run build` sao chép source vào `.github-pages-build`, chép cấu hình Pages thành `astro.config.mjs` trong thư mục này và chạy Astro với `--root`. Cách này tránh lỗi `ConfigNotFound` do truyền đường dẫn `--config` tuyệt đối trên GitHub Actions, đồng thời không sửa source gốc trong quá trình chuyển các API sang bản tĩnh.

## Tin tức trên GitHub Pages

GitHub Pages chỉ phục vụ file tĩnh, nên các endpoint đọc bài cần Node server không được deploy. Trong bản GitHub Pages, thẻ bài tin mở trực tiếp trang nguồn chính thức. Bước postbuild còn kiểm tra và chuyển đổi dự phòng mọi URL `/api/central-news-article` và `/api/province-news-article` còn sót lại trước khi validator chạy.

## Đường dẫn runtime và tương tác JavaScript

Bước postbuild chỉ sửa URL thật trong HTML/CSS (`href`, `src`, `data-href`, `srcset`, `url(...)`) và không thay chuỗi bên trong JavaScript. Các URL được tạo khi trang đang chạy phải đi qua `src/lib/site-path.ts` (`withBase(...)`) hoặc biến `siteBase`. Quy tắc này giữ nguyên các chuỗi cú pháp như `split('/')`, SVG `/>` và đồng thời bảo đảm fetch/chuyển trang hoạt động dưới base `/osavietnam`.
