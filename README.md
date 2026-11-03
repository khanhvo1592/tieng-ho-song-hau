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
