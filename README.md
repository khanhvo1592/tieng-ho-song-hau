# Vé mời sự kiện

Trang đăng ký vé mời. Tên chương trình, suất diễn và sơ đồ ghế sửa được trên trang, nên cùng một hệ thống dùng lại cho sự kiện sau.

Đăng ký và ghế nằm trong **một Durable Object SQLite** của Cloudflare Worker. Mọi lượt giữ ghế đi qua một chỗ, nên hai người không giữ được cùng một ghế.

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

## Đưa ra internet bằng Docker và Cloudflare Tunnel

1. Trong Cloudflare Zero Trust, tạo tunnel kiểu Docker và thêm một public hostname. **Service URL** phải là `http://web:8787`.
2. Sao chép token của tunnel.
3. Trên máy chủ:

```sh
cp .env.example .env
```

Điền `STAFF_PASSWORD`, `STAFF_SECRET` và `TUNNEL_TOKEN`, rồi chạy:

```sh
docker compose up -d --build
```

SQLite của Worker được giữ trong volume `venue-data`. Đổi sự kiện không cần tạo tên miền mới.

## Đưa Worker lên Cloudflare

Khi muốn SQLite nằm trên mạng Cloudflare thay vì trong volume Docker:

```sh
npx wrangler login
npx wrangler secret put STAFF_PASSWORD
npx wrangler secret put STAFF_SECRET
npm run deploy
```

Trang và API cùng một địa chỉ Worker. Tunnel không cần nữa.
