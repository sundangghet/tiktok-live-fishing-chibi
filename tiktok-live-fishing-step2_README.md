# Thuyền Câu Tu Tiên Chibi — Bước 2: Kết nối TikTok Live Thật

Bộ mã nguồn gồm:
- `server.js`: Máy chủ Node.js sử dụng `tiktok-live-connector` để lắng nghe sự kiện `chat`, `like`, `gift` từ TikTok ID và đẩy qua `socket.io` tới giao diện web.
- `public/index.html`: Giao diện game câu cá tu tiên chibi tối ưu màn hình dọc điện thoại, nhận sự kiện thời gian thực và vẫn giữ 4 nút giả lập để test bất cứ lúc nào.
- `package.json`: Danh sách thư viện cần cài (`express`, `socket.io`, `tiktok-live-connector`).

## Cách đẩy lên GitHub & chạy miễn phí trên Render (làm trực tiếp trên Safari iPhone)
1. Tạo một repository mới trên GitHub và tải 3 file (`package.json`, `server.js`, `public/index.html`) lên đúng cấu trúc thư mục như trên.
2. Đăng nhập **Render.com** bằng tài khoản GitHub, chọn **New +** -> **Web Service** và trỏ tới repository vừa tạo.
3. Để mặc định:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - (Tùy chọn) Thêm biến môi trường `TIKTOK_UNIQUE_ID` nếu muốn tự động nối sẵn một kênh khi server khởi động.
4. Sau khi Render báo **Live**, mở đường link `.onrender.com` trên Safari, nhập **TikTok ID** của phiên livestream đang phát và bấm **Vào Live**.
