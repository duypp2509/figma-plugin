---
name: chup-luong
description: Chụp các luồng người dùng đã có trong repo figma-flow-capture và đưa vào Figma hoặc lưu ra đĩa. Dùng khi người dùng nói "chụp luồng…", "chụp lại màn…", "cập nhật ảnh trên Figma", "chạy capture", "đưa luồng X vào Figma", "chụp hết", hoặc hỏi có những luồng nào. Không dùng để viết luồng mới (dùng tao-luong).
---

# Chụp luồng đã có

Mục tiêu: chạy đúng các luồng người dùng muốn, đưa kết quả tới đúng nơi, và báo lại trung thực cái gì xong, cái gì lỗi.

Chạy lệnh từ thư mục gốc của repo. PowerShell: `.\capture …`; bash: `./capture.cmd …`.

## 1. Kiểm tra môi trường

```powershell
.\capture --doctor --json
```

- Có mục `"status": "fail"`: dừng lại, nói cho người dùng mục đó và cách sửa trong `fix`. Hay gặp nhất là app chưa chạy; AI không tự bật app của người dùng, hãy nhờ họ bật.
- `warn` về plugin chưa build: chạy `npm run build:plugin` nếu sắp gửi sang Figma.
- Lệnh báo thiếu `node_modules` hoặc không chạy được: bảo người dùng chạy `.\setup`.

## 2. Tìm luồng khớp với yêu cầu

```powershell
.\capture --list --json
```

Đối chiếu yêu cầu với `id`, `name`, `group` (thư mục) và `figmaSections` (tên Section trên Figma). Người dùng thường gọi theo tên tính năng ("quên mật khẩu", "thành viên", "vai trò"), không theo id.

- Cả một nhóm: dùng tiền tố chung của các id, ví dụ `--flow "quen-mat-khau*"`. Kiểm tra lại bằng `.\capture --flow "<tiền-tố>*" --list` rằng nó chọn đúng các luồng mong muốn.
- Luồng có trường `caution`: không bao giờ chạy kèm. Chỉ chạy khi người dùng gọi đúng luồng đó, sau khi bạn đã nhắc lại nội dung `caution` và họ xác nhận.
- Không có luồng nào khớp: nói rõ, liệt kê các nhóm gần nhất, và hỏi họ có muốn viết luồng mới không (skill `tao-luong`).

## 3. Hỏi những gì chưa rõ

Chỉ hỏi điều yêu cầu chưa nói. Hỏi gộp trong một lần (Claude Code: dùng AskUserQuestion), tối đa ba câu:

1. **Chụp những luồng nào**, khi yêu cầu khớp nhiều nhóm hoặc quá chung ("chụp đi"). Đưa các nhóm tìm được kèm số luồng, và lựa chọn "tất cả".
2. **Kết quả đưa đi đâu**:
   - Gửi sang Figma, ảnh phẳng (mặc định khi người dùng nhắc tới Figma).
   - Chỉ lưu ra đĩa (`--no-figma`): nhanh, không cần Figma; nên chọn khi chỉ muốn kiểm tra.
   - Figma, layer chỉnh sửa được (`--render layers`): người dùng phải nhấn Ctrl+V cho từng màn; chỉ Windows.
3. **Trên Figma: ghi đè luồng cũ hay tạo Section mới**. Đây là lựa chọn trong cửa sổ plugin, người dùng tự chọn ở đó; chỉ cần nhắc họ.

Không hỏi về `--headed`: mặc định chạy ngầm. Chỉ thêm `--headed` khi người dùng muốn xem, hoặc khi đang tìm lỗi.

## 4. Trước khi gửi sang Figma

AI không mở được Figma. Nhắc người dùng làm đủ ba việc rồi chờ họ xác nhận:

1. Mở file Figma và đúng page muốn đặt ảnh (Section mới được đặt trên page đang mở).
2. Chạy plugin: Plugins → Development → Flow Capture.
3. Giữ cửa sổ plugin mở tới khi lệnh chạy xong.

Chưa từng import plugin: Plugins → Development → Import plugin from manifest… → `plugin/manifest.json`.

## 5. Chạy

```powershell
.\capture --flow "<id hoặc tiền-tố*>" [--flow …] [--no-figma] [--render layers]
```

- Nhiều luồng mất vài phút (khoảng 5–15 giây mỗi luồng). Đặt thời gian chờ của lệnh đủ dài, hoặc chạy nền và theo dõi.
- Khi gửi Figma, CLI chờ plugin tối đa 2 phút. Hết giờ mà chưa nối: plugin chưa mở, nhắc lại bước 4.
- Không dùng `--auto-paste` trừ khi người dùng yêu cầu và đã biết phải để yên máy.

## 6. Đọc kết quả

Đọc `captures/_last-run.json`:

- `ok: true`: mọi luồng hoàn tất.
- Luồng `incomplete`: đọc `errorLog`, mở `errorScreenshot` để nhìn màn hình lúc lỗi, rồi phân loại:

| Dấu hiệu | Nguyên nhân | Việc cần làm |
| --- | --- | --- |
| `net::ERR_CONNECTION_REFUSED` | App không chạy | Nhờ người dùng bật app |
| `Timeout … waiting for locator` | Nhãn hay cấu trúc màn hình của app đã đổi | Sửa luồng theo skill `tao-luong` |
| `Phần tử vẫn bị khóa` | Captcha chưa qua | Kiểm tra mạng tới Cloudflare; xem mục Captcha trong README |
| `Plugin Figma không kết nối` / `đã ngắt kết nối` | Plugin chưa mở hoặc bị đóng | Nhắc bước 4 rồi chạy lại luồng đó |
| Dòng `chưa giả lập: GET /v1/…` trong đầu ra | App gọi API mà luồng chưa giả lập | Bổ sung theo skill `tao-luong` |

Với lần chạy `--no-figma`, mở vài ảnh trong `screenshots` để chắc ảnh đúng màn, không trắng, không dở dang tải.

## 7. Báo lại

Nêu: bao nhiêu luồng hoàn tất trên tổng số, bao nhiêu màn, ảnh ở thư mục nào, đã gửi sang Figma hay chưa. Luồng lỗi: tên luồng, nguyên nhân, và việc bạn đề xuất. Không nói "xong" khi còn luồng chưa hoàn tất.
