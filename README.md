# Vé mời sự kiện

Trang đăng ký vé mời. Tên chương trình, suất diễn và sơ đồ ghế sửa được trên trang, nên cùng một hệ thống dùng lại cho sự kiện sau.

Trang và API cùng nằm trên **Cloudflare Workers**. File `index.html` được phát bằng Static Assets. Đăng ký và ghế nằm trong **một Durable Object SQLite**. Mọi lượt giữ ghế đi qua một chỗ, nên hai người không giữ được cùng một ghế.

## Chạy trên máy

```sh
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

Mở http://127.0.0.1:8787. Mật khẩu trong `.dev.vars` dùng cho nút **Ban tổ chức**.

Khi trang đang chạy, kiểm tra giữ ghế, ghế trùng và đăng nhập ban tổ chức:

```sh
npm run check
```

## Ảnh và thông tin trang chủ

Vào `/to-chuc`, đăng nhập, mở khu **Trang chủ và nhận diện** trong form sự kiện:

- **Đơn vị tổ chức**: hiện ở chân trang, đầu ảnh vé QR và dữ liệu SEO.
- **Logo**, **Poster**: bấm *Chọn ảnh*, rồi *Lưu thông tin sự kiện*.
- **Nghệ sĩ**: thêm, xóa, đổi thứ tự (↑), sửa danh hiệu, tên và ảnh. Xóa hết thì trang chủ ẩn khối nghệ sĩ.

Ảnh được thu nhỏ trên trình duyệt (logo 512 px PNG, ảnh nghệ sĩ 900 px, poster 1400 px JPEG) rồi lưu trong SQLite của Durable Object, phát qua `/api/images/<mã>`. Mã ảnh là băm nội dung nên trình duyệt giữ ảnh trong bộ nhớ đệm lâu dài. Ảnh tải lên quá một ngày mà không dùng trong cấu hình được xóa ở lần lưu cấu hình kế tiếp; kho giữ tối đa 80 ảnh.

Thiếu ảnh nào thì trang tự dùng hình thay thế:

| Thành phần | Khi chưa có ảnh |
| --- | --- |
| Ảnh nghệ sĩ | Chữ lồng hai chữ cái cuối của tên (ví dụ "QT") trên nền xanh |
| Poster | Thử file tĩnh `anh/poster.jpg`, không có thì ẩn khung poster |
| Logo | Thử file tĩnh `anh/logo.png`, không có thì dùng dấu hoa sen vàng |

Ảnh nghệ sĩ nên dọc tỉ lệ 4:5, mặt ở nửa trên; logo nên vuông, nền trong suốt hoặc trắng.

## Đưa lên Cloudflare

Đăng nhập tài khoản Cloudflare, rồi đặt hai bí mật. Wrangler hỏi giá trị trên bàn phím, không đưa giá trị vào lệnh.

```sh
npx wrangler login
npx wrangler secret put STAFF_PASSWORD
npx wrangler secret put STAFF_SECRET
npm run deploy
```

Lệnh deploy đăng trang lên `ve-moi.<tài-khoản>.workers.dev`. SQLite của ghế nằm trên Cloudflare, cùng Worker.

Muốn dùng tên miền riêng, thêm tên miền đó vào Cloudflare rồi gắn làm custom domain của Worker `ve-moi`. DNS và trang cùng một tài khoản Cloudflare.

Để mỗi lần đẩy git là Cloudflare tự đăng bản mới, nối kho này với Workers Builds và đặt lệnh deploy là `npm run deploy`.
