# Content Studio

Content Studio thay thế toàn bộ trang quản trị cũ. Giao diện đọc và ghi trực tiếp các collection Markdown trong `src/content`, có bản nháp trong trình duyệt, live preview và luồng gửi nội dung lên GitHub.

## Chạy local

Mở hai terminal tại thư mục dự án:

```bash
npm run dev
npm run admin
```

Sau đó mở `http://localhost:4321/admin/`.

`npm run dev` phục vụ website và live preview. `npm run admin` chạy API biên tập ở cổng 4322. API này chỉ dành cho máy biên tập; không đưa token GitHub vào trình duyệt hoặc bundle production.

## Trạng thái nội dung

- Thay đổi trong form được live preview ngay và tự lưu tạm trong `localStorage`.
- Collection **Banner & trích dẫn** cho phép sửa trực tiếp câu trích, nguồn trích trong preview; ảnh banner có thể chọn từ thư viện hoặc tải mới.
- Collection **Thánh – Chân phước** có bộ chọn/tải ảnh cho `imageFile`; khi lưu, ảnh thẻ trong chỉ mục thánh cũng được đồng bộ.
- Khi `npm run admin` đang chạy, các công cụ sửa trực tiếp tự xuất hiện trên mọi trang đã hỗ trợ; không cần thêm `?admin=1`. Khi Admin API tắt hoặc ở production, chúng tự ẩn.
- Trang Thánh – Chân phước cho phép sửa từng thẻ; tab Niên Biểu cho phép sửa từng sự kiện và lưu thay đổi tại `src/data/augustine-timeline-overrides.json`.
- Trang Kinh Sách cho phép sửa từng hàng trong bảng chỉ mục; trang nội dung sửa được cả metadata và Markdown. Sau khi lưu, `src/data/kinh-sach-index.json` được dựng lại tự động.
- **Lưu** ghi nội dung về source dưới dạng bản nháp nếu collection có trường `draft`.
- **Xuất bản** chuyển `draft` về `false`, ghi source, rồi gửi file lên GitHub nếu đã cấu hình.
- **Thùng rác** chuyển file vào `temp_/studio-trash`, không xóa vĩnh viễn.

## Kết nối repository private

Tạo `.env.local` từ `.env.example` và điền:

```dotenv
STUDIO_GITHUB_REPO=osavietnam/osavietnam
STUDIO_GITHUB_BRANCH=main
STUDIO_GITHUB_TOKEN=github_pat_xxx
```

Token nên là fine-grained personal access token, chỉ cấp quyền `Contents: Read and write` cho đúng repository. Không commit `.env.local`.

Khi bấm **Xuất bản**, API dùng GitHub Contents API để tạo commit. GitHub Actions có thể tiếp tục build dự án và deploy output lên Hostinger. Credentials Hostinger nên đặt trong GitHub Actions Secrets, không đặt trong source.

## Phạm vi hiện tại

Studio hỗ trợ các collection: bài viết, Kinh Sách, thánh và chân phước, văn kiện, Tự Thuật, lịch sử Dòng, sách, các thư viện Augnet và bách khoa Thánh Augustinô. Schema trường được khai báo tập trung trong `scripts/admin-server.mjs`.
