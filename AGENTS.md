# figma-flow-capture: hướng dẫn cho công cụ AI

Công cụ này chạy từng luồng người dùng trên app bằng Playwright, chụp màn hình ở mỗi bước và dựng thành Section trong Figma. Tài liệu cho người dùng ở [README.md](README.md); file này là phần AI cần biết trước khi làm việc trong repo.

```
CLI (capture/, Playwright)  →  server trung chuyển 127.0.0.1:8765 (server/)  →  plugin Flow Capture trong Figma desktop (plugin/)
```

## Hai việc người dùng hay nhờ

| Việc | Quy trình phải theo |
| --- | --- |
| Chụp luồng đã có, đưa vào Figma hoặc lưu ra đĩa | [.claude/skills/chup-luong/SKILL.md](.claude/skills/chup-luong/SKILL.md) |
| Viết luồng mới, hoặc sửa luồng đang lỗi | [.claude/skills/tao-luong/SKILL.md](.claude/skills/tao-luong/SKILL.md) |

Claude Code tự nạp hai quy trình này dưới dạng skill. Công cụ khác: đọc file tương ứng trước khi bắt đầu.

## Lệnh

Chạy từ thư mục gốc của repo. Trong PowerShell dùng `.\capture`; trong bash dùng `./capture.cmd`. Không dùng `npm run capture -- <cờ>` trong PowerShell: dấu `--` bị nuốt.

| Lệnh | Tác dụng |
| --- | --- |
| `.\capture --doctor --json` | Máy đã sẵn sàng chưa: Chromium, plugin, app có đang chạy, mã nguồn app ở đâu |
| `.\capture --list --json` | Mọi luồng: `id`, `name`, `group`, `figmaSections`, `file`, `caution` |
| `.\capture --flow <id> --no-figma` | Chụp và chỉ lưu ảnh vào `captures/<id>/` |
| `.\capture --flow <id>` | Chụp và gửi sang Figma (plugin phải đang mở) |
| `.\capture --flow "<tiền-tố>*"` | Mọi luồng có id bắt đầu bằng tiền tố |
| `.\capture --all` | Mọi luồng, trừ luồng có `caution` |
| `npm run typecheck` | Kiểm tra kiểu sau khi sửa code |

Sau mỗi lần chạy, kết quả nằm ở `captures/_last-run.json` (trạng thái từng luồng, danh sách ảnh, đường dẫn `_loi.png` và `_loi.log` nếu lỗi). Đọc file này thay vì dò chữ trong terminal. Lệnh thoát mã khác 0 khi có luồng chưa hoàn tất.

## Quy tắc bắt buộc

1. **Luôn chọn luồng rõ ràng** bằng `--flow` hoặc `--all`. `.\capture` không kèm cờ là menu cho người dùng; chạy không có terminal thì nó báo lỗi.
2. **Luồng có `caution` gây hậu quả thật** (ví dụ `dang-ky-shop` tạo tài khoản và tốn OTP). Chỉ chạy khi người dùng yêu cầu đúng luồng đó và đã được nhắc lại hậu quả. Dùng bản giả lập (`dang-ky-shop-mock`) cho mọi trường hợp khác.
3. **Không sửa code của app.** Mã nguồn app và backend (đường dẫn trong `--doctor`) chỉ để đọc: lấy nhãn, route, API, câu báo lỗi.
4. **Chụp ra đĩa và tự xem ảnh trước** (`--no-figma`, rồi mở các file PNG). Chỉ gửi sang Figma khi ảnh đã đúng và người dùng đồng ý.
5. **Gửi sang Figma cần người dùng làm tay**: mở đúng file và page trong Figma desktop, chạy plugin Flow Capture, giữ cửa sổ plugin mở. AI không mở được plugin; hãy nhắc người dùng rồi mới chạy. CLI chờ plugin tối đa 2 phút.
6. **`--render layers --auto-paste` chiếm quyền bàn phím** của máy trong lúc dán. Chỉ dùng khi người dùng đã biết và đồng ý để yên máy.
7. **Mỗi lần chạy xóa và ghi lại `captures/<id>/`** của các luồng được chạy.
8. **Giữ nguyên `id` luồng và `stepId`** của luồng đã có: chúng là khóa của Section và frame trên Figma, đổi là tạo bản mới thay vì cập nhật.
9. **Thêm, bớt hay đổi luồng thì cập nhật bảng ở mục 8 của README.**

## Thư mục

| Đường dẫn | Nội dung |
| --- | --- |
| `capture/` | CLI: `cli.ts` (cờ), `runner.ts` (chạy luồng, `shot()`), `define.ts` (`defineFlow`), `config.ts`, `doctor.ts`, `interactive.ts` (menu) |
| `capture.config.ts` | App, viewport, phần tử bị ẩn khi chụp, bố cục trên Figma |
| `flows/**/*.flow.ts` | Các luồng; thư mục con là một nhóm |
| `flows/_helpers/` | Backend giả lập, phiên đăng nhập, captcha, đồng hồ |
| `plugin/src/` | Plugin Figma; sửa xong phải `npm run build:plugin` và mở lại plugin |
| `server/`, `shared/types.ts` | Server trung chuyển và định dạng tin nhắn |
| `captures/` | Ảnh đầu ra, không vào git |

## Ngôn ngữ

Người dùng và giao diện app dùng tiếng Việt: trả lời bằng tiếng Việt, tên bước (`title` của `shot()`) viết tiếng Việt có dấu, `id` và `stepId` viết không dấu, chữ thường, nối bằng gạch ngang. Chú thích trong code viết bằng tiếng Anh như code hiện có.
