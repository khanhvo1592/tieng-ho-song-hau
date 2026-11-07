# Hướng dẫn sử dụng và quản trị

Trang có 4 địa chỉ (thay `ten-mien` bằng địa chỉ thật, ví dụ `ve-moi.<tài-khoản>.workers.dev`):

| Địa chỉ | Ai dùng | Để làm gì |
| --- | --- | --- |
| `ten-mien/` | Khán giả | Trang chủ: giới thiệu, suất diễn, nghệ sĩ, hỏi đáp |
| `ten-mien/dat-ve` | Khán giả | Chọn ghế, đặt vé, tra cứu và hủy vé |
| `ten-mien/to-chuc` | Ban tổ chức | Đăng nhập quản trị, sửa sự kiện, xem danh sách |
| `ten-mien/check-in` | Ban tổ chức (quầy đón khách) | Tra vé và xác nhận khách vào cửa |

---

## 1. Đăng nhập Ban tổ chức

1. Mở `ten-mien/to-chuc`.
2. Nhập **mật khẩu ban tổ chức**, bấm **Vào quản trị**.
3. Đăng nhập giữ được **12 giờ** trên trình duyệt đó. Xong việc bấm **Thoát** (nhất là khi dùng máy chung).

Trang `/check-in` dùng cùng mật khẩu. Đã đăng nhập ở một trang thì sang trang kia không phải nhập lại.

### Quên mật khẩu hoặc muốn đổi mật khẩu

Mật khẩu không nằm trong code mà là "bí mật" lưu trên Cloudflare (`STAFF_PASSWORD`). Không xem lại được mật khẩu cũ, chỉ đặt mật khẩu mới. Trên máy có kho code, mở terminal tại thư mục dự án:

```sh
npx wrangler login
npx wrangler secret put STAFF_PASSWORD
```

Wrangler hỏi giá trị: gõ mật khẩu mới, Enter. Có hiệu lực ngay, không cần deploy lại.

Muốn **đăng xuất mọi máy đang đăng nhập** (ví dụ lộ mật khẩu): đặt lại cả `STAFF_SECRET` bằng một chuỗi dài ngẫu nhiên:

```sh
npx wrangler secret put STAFF_SECRET
```

> Khi chạy thử trên máy (`npm run dev`), mật khẩu nằm trong file `.dev.vars` (chép từ `.dev.vars.example`). File này chỉ dùng trên máy, không đưa lên Cloudflare.

---

## 2. Sửa thông tin sự kiện (trang `/to-chuc`)

Sau khi đăng nhập, khung **Tùy chỉnh sự kiện** hiện ra. Sửa xong bấm **Lưu thông tin sự kiện** ở cuối form. Chưa bấm Lưu thì khách chưa thấy thay đổi.

**Thông tin chung**
- Dòng mày, Tên chương trình, Tên in nghiêng, Mô tả, Địa điểm, Giờ mở cửa, Điện thoại.
- **Số ghế tối đa mỗi lượt**: một người được giữ tối đa bao nhiêu ghế (1–20).
- **Câu về vé**: dòng nhắc in trên trang đặt vé.
- **Ghế không mở**: ghế khóa không cho đặt, ghi cách nhau dấu phẩy, ví dụ `1A1, 1A14, L1B7`.
- **Có lối đi giữa mỗi hàng**: vẽ lối đi trên sơ đồ.
- **Mở đặt ghế trên lầu cho khách**: bỏ chọn thì khách chỉ đặt được tầng trệt. Ban tổ chức vẫn xếp ghế lầu được. Ghế lầu khách đã giữ trước đó không bị mất.

**Trang chủ và nhận diện**
- Ba ô ẩn/hiện: **khối nghệ sĩ và poster**, **logo ở chân trang**, **nút "Gọi Ban tổ chức"** ở trang chủ. Bỏ chọn rồi Lưu là ẩn.
- **Đơn vị tổ chức**: hiện ở chân trang và đầu ảnh vé.
- **Logo**, **Poster**: bấm *Chọn ảnh* → chọn file JPG/PNG/WebP. Ảnh tự thu nhỏ trước khi gửi. *Bỏ ảnh* để quay về hình mặc định.
- **Nghệ sĩ**: *Thêm nghệ sĩ*, điền danh hiệu (NSND, NSƯT…), tên, chọn ảnh. Nút ↑ để đổi thứ tự, *Xóa* để bỏ. Nghệ sĩ nào chưa có ảnh thì hiện chữ lồng hai chữ cái của tên.
- Ảnh nghệ sĩ nên dọc (4:5), mặt ở nửa trên. Logo nên vuông, nền trong suốt hoặc trắng.

**Suất diễn**
- Ngày dạng `22/11`, giờ dạng `19:30`, nhãn có năm.
- **Không đổi mã suất** của suất đã có người đăng ký, nếu không các đăng ký đó sẽ lạc suất (trang sẽ cảnh báo "đăng ký không thuộc suất nào").

**Sơ đồ ghế**
- Mỗi hàng có nhãn ngắn (ví dụ `1A`, `L1A`) và số ghế. Ghế được đánh số `1A1`, `1A2`…
- Ô **Khóa** cạnh mỗi hàng: khóa cả hàng, khách không đặt được (Ban tổ chức vẫn đặt hộ được). Mặc định khối 2 hàng **2A–2D** đang khóa; bỏ chọn rồi Lưu để mở.
- Sơ đồ hiện tại khớp nhà biểu diễn: tầng trệt 508 ghế, trên lầu 216 ghế. Chỉ sửa khi đổi địa điểm.

---

## 3. Xem và xuất danh sách đăng ký

Dưới form sự kiện là **Danh sách đăng ký**: mã vé, họ tên, điện thoại, email, ghế, số vé, đơn vị, ghi chú, lúc gửi. Có tổng số theo suất ở đầu bảng. Danh sách tự cập nhật khi có người đăng ký.

Cột **Thao tác** mỗi dòng:
- **Sửa**: mở trang đặt vé với đăng ký đó, sửa tên, số điện thoại, ghi chú hoặc đổi ghế trên sơ đồ, rồi **Xác nhận**.
- **Xóa**: hỏi lại một lần, rồi xóa vé và trả ghế. Không hoàn tác được.

Xuất danh sách (file tạo ngay trên máy, tên dạng `danh-sach-ve-2026-11-07.xlsx`):
- **Tải Excel**: mỗi suất một trang tính (có thêm trang *Tất cả* khi có nhiều suất), xếp theo ghế. Số điện thoại giữ nguyên số 0 đầu, có dòng tiêu đề cố định, bộ lọc và dòng tổng số vé. Mở được bằng Excel, Google Sheets, LibreOffice.
- **Tải Word**: khổ A4 nằm ngang, mỗi suất một trang có tiêu đề và bảng, kèm cột **Ký nhận** để in cho quầy đón khách.
- **Sao chép bảng**: chép dạng văn bản để dán nhanh vào nơi khác.

---

## 4. Đặt vé hộ khách (Ban tổ chức)

Khi đã đăng nhập Ban tổ chức, mở `/dat-ve`:
1. Phần **Cách đặt** chọn **Đặt hộ khách**.
2. Chọn suất, bấm ghế trên sơ đồ, điền họ tên và số điện thoại của khách, **Xác nhận đặt**.
3. Tải ảnh vé (có QR) gửi cho khách qua Zalo/tin nhắn.

Ban tổ chức đặt được cả ghế trên lầu khi lầu đang đóng với khách.

---

## 5. Check-in tại cửa (trang `/check-in`)

1. Đăng nhập bằng mật khẩu ban tổ chức (nếu chưa).
2. Nhập **mã vé** (ví dụ `VE-XXXXX`, in trên ảnh vé dưới mã QR), **hoặc** họ tên + số điện thoại.
3. Bấm **Tra cứu** → kiểm tra suất và ghế → bấm xác nhận vào cửa.
4. Vé đã check-in rồi sẽ báo đã vào, tránh một vé dùng hai lần.

Mẹo: dùng điện thoại quét QR trên vé bằng camera để đọc mã, rồi gõ mã vào ô tra cứu.

---

## 6. Khán giả đặt vé như thế nào (để hướng dẫn lại cho khách)

1. Vào `ten-mien`, bấm **Đặt vé** (hoặc vào thẳng `/dat-ve`).
2. Chọn **suất diễn**.
3. Bấm các ghế còn trống trên sơ đồ (màu xanh nhạt; ghế xám là đã có người). Dùng nút +/− hoặc tab **Tầng trệt / Trên lầu** để xem.
4. Bấm **Đặt ghế**, điền họ tên, số điện thoại, **Xác nhận đặt**.
5. **Tải vé** về máy. Đến nơi đưa mã QR cho quầy check-in.

Mất vé hoặc muốn hủy: vào `/dat-ve`, phần **Kiểm tra vé**, nhập đúng họ tên và số điện thoại đã đăng ký → xem lại vé, sửa hoặc hủy.

---

## 7. Đưa bản mới lên mạng (deploy)

Chỉ cần khi sửa code. Sửa thông tin sự kiện ở `/to-chuc` thì **không cần** deploy.

```sh
npm install
npx wrangler login
npm run deploy
```

Nếu kho đã nối với **Workers Builds** của Cloudflare, chỉ cần đẩy code lên nhánh chính là Cloudflare tự đăng bản mới.

Dữ liệu đăng ký và ảnh nằm trên Cloudflare (Durable Object), deploy lại không làm mất.

---

## 8. Hỏi nhanh

| Tình huống | Làm gì |
| --- | --- |
| Quên mật khẩu | Mục 1: `npx wrangler secret put STAFF_PASSWORD` |
| Khách báo không thấy ghế lầu | Kiểm tra ô *Mở đặt ghế trên lầu cho khách* ở `/to-chuc` |
| Muốn khóa vài ghế cho khách mời | Ghi vào ô *Ghế không mở*, hoặc đặt hộ khách cho các ghế đó |
| Sửa xong khách vẫn thấy bản cũ | Đã bấm *Lưu thông tin sự kiện* chưa? Bảo khách tải lại trang |
| Ảnh không hiện | Ảnh quá 1,5 MB sau khi thu nhỏ, hoặc không phải JPG/PNG/WebP. Chọn ảnh khác |
| Kiểm tra hệ thống còn chạy | Mở `ten-mien/api/health` |
