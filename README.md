# figma-flow-capture

Công cụ tự chạy từng luồng người dùng trên app bằng Playwright, chụp màn hình ở mỗi bước rồi dựng thành Section trong Figma: mỗi luồng một Section, các bước là frame xếp từ trái sang phải. Chạy lại một luồng thì ảnh trong đúng frame cũ được thay, không phải xếp lại bằng tay.

Công cụ độc lập với các repo khác trong workspace: nó chỉ mở app trong trình duyệt, không sửa gì trong code của app.

```
CLI (Playwright)  ──ws──►  server local 127.0.0.1:8765  ──ws──►  plugin Flow Capture (Figma desktop)
   chụp ảnh                    chỉ chuyển tiếp                      dựng Section và frame
```

## Mục lục

1. [Yêu cầu](#1-yêu-cầu)
2. [Cài đặt lần đầu](#2-cài-đặt-lần-đầu)
3. [Chạy thử lần đầu](#3-chạy-thử-lần-đầu)
   - [Dùng với công cụ AI](#dùng-với-công-cụ-ai)
4. [Các lệnh và cờ](#4-các-lệnh-và-cờ)
5. [Cửa sổ plugin trong Figma](#5-cửa-sổ-plugin-trong-figma)
6. [Kết quả trên Figma](#6-kết-quả-trên-figma)
7. [Chế độ layers: frame chỉnh sửa được](#7-chế-độ-layers-frame-chỉnh-sửa-được)
8. [Các luồng có sẵn](#8-các-luồng-có-sẵn)
9. [Viết một luồng mới](#9-viết-một-luồng-mới)
10. [Cấu hình](#10-cấu-hình)
11. [Kiểm tra công cụ khi không có app](#11-kiểm-tra-công-cụ-khi-không-có-app)
12. [Lỗi thường gặp](#12-lỗi-thường-gặp)
13. [Cấu trúc thư mục](#13-cấu-trúc-thư-mục)
14. [Giới hạn hiện tại](#14-giới-hạn-hiện-tại)

## 1. Yêu cầu

| Cần có | Ghi chú |
| --- | --- |
| Windows | Lệnh `.\capture` và chế độ layers chỉ chạy trên Windows. Trên macOS/Linux vẫn chụp ảnh được bằng `npm run capture -- <cờ>`, nhưng không dùng được `--render layers` |
| Node.js 22 trở lên | Kiểm tra bằng `node -v` |
| Figma desktop | Plugin không chạy trên Figma bản trình duyệt. Không cần nếu chỉ lưu ảnh ra đĩa (`--no-figma`) |
| Quyền chỉnh sửa file Figma | Plugin tạo Section và frame trong file đang mở |
| App cần chụp đang chạy ở máy | SuperShip Web ở `http://localhost:3001`, SuperPlatform ở `http://localhost:3000`. Đổi địa chỉ ở [mục 10](#10-cấu-hình) |

Hầu hết luồng có sẵn dùng backend giả lập ngay trong trình duyệt, nên chỉ cần frontend chạy, không cần backend và không tạo dữ liệu thật. Ngoại lệ duy nhất là luồng `dang-ky-shop` (xem [mục 8](#8-các-luồng-có-sẵn)).

## 2. Cài đặt lần đầu

Mở PowerShell tại thư mục `figma-flow-capture` và chạy một lệnh:

```powershell
.\setup
```

Lệnh này cài thư viện, tải Chromium cho Playwright, build plugin Figma, rồi kiểm tra máy đã sẵn sàng chưa. Muốn kiểm tra lại bất cứ lúc nào: `.\capture --doctor`. Nó báo từng mục ✔ hoặc ✘ kèm cách sửa, ví dụ app chưa chạy.

Sau đó nạp plugin vào Figma, chỉ làm một lần:

1. Mở Figma desktop, mở một file bất kỳ.
2. Menu Plugins → Development → Import plugin from manifest…
3. Chọn file `plugin/manifest.json` trong thư mục này.

Plugin xuất hiện với tên **Flow Capture** ở Plugins → Development.

Thư mục `plugin/dist` không nằm trong git, nên ai mới lấy code về cũng phải build plugin (`.\setup` đã làm việc này). Mỗi khi code trong `plugin/src` thay đổi (ví dụ sau khi pull), chạy lại lệnh đó rồi đóng và mở lại plugin.

## 3. Chạy thử lần đầu

Dùng luồng `dang-ky-shop-mock`: 4 màn, không tạo tài khoản, không tốn OTP.

**Bước 1. Bật app.** Chạy SuperShip Web ở `http://localhost:3001` và mở thử trang `/register` trong trình duyệt để chắc là app lên.

**Bước 2. Chụp ra đĩa trước, chưa cần Figma.**

```powershell
.\capture --flow dang-ky-shop-mock --no-figma
```

Kết quả mong đợi:

```
[dang-ky-shop-mock] 01 Form đăng ký → captures\dang-ky-shop-mock\01-form.png (…)
[dang-ky-shop-mock] 02 Chọn kênh nhận OTP → …
…
Kết quả:
  ✔ dang-ky-shop-mock: 4 bước → captures\dang-ky-shop-mock
```

Mở thư mục `captures/dang-ky-shop-mock` để xem ảnh.

**Bước 3. Gửi sang Figma.**

1. Mở file Figma và đúng page muốn đặt ảnh.
2. Chạy plugin: Plugins → Development → Flow Capture. Giữ cửa sổ plugin mở.
3. Chạy lệnh:

   ```powershell
   .\capture --flow dang-ky-shop-mock
   ```

4. Dòng "Kết nối" trong plugin chuyển sang chấm xanh, rồi Section "Đăng ký Shop (mock)" hiện trên canvas với 4 frame. Figma tự cuộn tới Section vừa dựng.

Không cần chạy server riêng: CLI tự khởi động server nếu chưa có, và chờ plugin kết nối tối đa 2 phút.

## Dùng với công cụ AI

Repo có sẵn hướng dẫn cho công cụ AI, nên sau khi chạy `.\setup` bạn có thể mở Claude Code (hoặc Codex, Cursor, Copilot…) ngay trong thư mục này và ra yêu cầu bằng lời, không cần giải thích công cụ hoạt động thế nào.

Ví dụ yêu cầu:

- "Có những luồng nào về thành viên cửa hàng?"
- "Chụp nhóm quên mật khẩu, chỉ lưu ra đĩa cho tôi xem trước."
- "Chụp lại luồng xác thực email rồi đưa vào Figma."
- "Tạo luồng cho màn đổi mật khẩu: thành công, nhập sai mật khẩu cũ, mật khẩu mới chưa đạt."
- "Luồng thông tin cửa hàng đang lỗi, xem giúp."

AI sẽ làm gì:

1. Kiểm tra máy (`--doctor`) và xem danh sách luồng (`--list`).
2. Hỏi lại những gì yêu cầu chưa nói: chụp nhóm nào hay tất cả, đưa sang Figma hay chỉ lưu ra đĩa, ảnh phẳng hay layer chỉnh sửa được.
3. Chạy lệnh, đọc kết quả, tự mở ảnh để kiểm tra, rồi báo lại. Luồng lỗi thì nó đọc ảnh và log lúc lỗi để nêu nguyên nhân.
4. Với luồng mới: đọc mã nguồn app để lấy nhãn và API, viết file luồng cùng backend giả lập, chạy thử, cho bạn xem ảnh trước khi đưa vào Figma.

Những việc bạn vẫn phải tự làm:

- **Bật app** cần chụp (AI không tự bật app của bạn).
- **Mở plugin Flow Capture trong Figma desktop**, đúng file và đúng page, trước khi gửi ảnh sang. AI sẽ nhắc bạn ở bước này.
- **Chỉ đường tới mã nguồn app** nếu nó không nằm cạnh thư mục này: đặt `SUPERSHIP_SRC`, `BACKEND_SRC` trong `.env` ([mục 10](#10-cấu-hình)). Chỉ cần khi viết luồng mới.

Hướng dẫn cho AI nằm ở:

| File | Nội dung |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Tóm tắt công cụ, lệnh, quy tắc bắt buộc. Claude Code đọc nó qua `CLAUDE.md`; nhiều công cụ khác tự đọc `AGENTS.md` |
| [.claude/skills/chup-luong/SKILL.md](.claude/skills/chup-luong/SKILL.md) | Quy trình chụp luồng đã có. Trong Claude Code gọi được bằng `/chup-luong` |
| [.claude/skills/tao-luong/SKILL.md](.claude/skills/tao-luong/SKILL.md) | Quy trình viết luồng mới và sửa luồng lỗi. Gọi bằng `/tao-luong` |
| [.claude/settings.json](.claude/settings.json) | Cho phép sẵn các lệnh `capture`, `npm run typecheck`… để Claude Code không hỏi quyền từng lần |

Luồng có cảnh báo ⚠ (hiện chỉ `dang-ky-shop`, tạo tài khoản thật) không bao giờ chạy kèm khi chọn "tất cả" hay theo tiền tố; AI cũng được dặn chỉ chạy khi bạn gọi đúng luồng đó và xác nhận.

## 4. Các lệnh và cờ

### Menu, không cần nhớ lệnh

```powershell
.\capture
```

Gõ `.\capture` không kèm gì thì công cụ mở menu và hỏi lần lượt:

1. **Chụp những luồng nào**: chọn theo nhóm, tìm và chọn từng luồng (gõ vài chữ để lọc), hoặc tất cả.
2. **Kết quả đưa đi đâu**: gửi sang Figma, chỉ lưu ra đĩa, hoặc layer chỉnh sửa được (dán tay hay tự dán).
3. **Có mở cửa sổ trình duyệt để xem không**.

Dùng phím mũi tên để di chuyển, Space để chọn, Enter để xác nhận. Ở bước nào cũng quay lại bước trước được bằng Esc hoặc mục "← Quay lại"; Ctrl+C thoát hẳn. Trước khi chạy, menu in ra "Lệnh tương đương" để lần sau bạn gõ thẳng hoặc đưa vào script.

Mục "Xem danh sách luồng" cho chọn một nhóm rồi hiện id và tên các luồng trong nhóm đó.

### Gõ lệnh trực tiếp

Trong PowerShell luôn dùng `.\capture`. Đừng dùng `npm run capture -- <cờ>`: PowerShell nuốt mất dấu `--` nên cờ không tới được CLI.

```powershell
.\capture --list                                   # liệt kê mọi luồng tìm thấy
.\capture --flow dang-ky-shop-mock --no-figma      # chỉ lưu ảnh vào captures/
.\capture --flow dang-ky-shop-mock                 # chụp và gửi sang Figma
.\capture --flow "quen-mat-khau*"                  # mọi luồng có id bắt đầu bằng quen-mat-khau
.\capture --flow dang-ky-shop-mock --flow xac-thuc-email-thanh-cong   # nhiều luồng
.\capture --all                                    # tất cả luồng, trừ luồng có cảnh báo ⚠
.\capture --doctor                                 # kiểm tra máy đã sẵn sàng chưa
.\capture --help
```

| Cờ | Tác dụng |
| --- | --- |
| `--list` | Liệt kê id và tên của từng luồng, gom theo nhóm, rồi thoát |
| `--doctor` | Kiểm tra Node, Chromium, plugin, app có đang chạy, mã nguồn app, kết nối Figma; thoát mã khác 0 nếu có mục bắt buộc hỏng |
| `--json` | Cùng `--list` hoặc `--doctor`: in JSON cho script và công cụ AI |
| `--all` | Chạy mọi luồng, không mở menu. Luồng có cảnh báo ⚠ bị bỏ qua, phải gọi đúng id bằng `--flow` |
| `--flow <id>` | Chỉ chạy luồng này. Lặp lại được. Kết thúc bằng `*` để chọn theo tiền tố; nhớ đặt trong dấu nháy kép |
| `--viewport <tên>` | Chỉ chạy viewport này (`desktop`, `mobile`) với luồng khai báo nhiều viewport |
| `--no-figma` | Chỉ lưu ảnh ra đĩa, không cần Figma hay plugin |
| `--headed` | Mở cửa sổ trình duyệt để xem luồng chạy |
| `--pause-on-step <stepId>` | Dừng ngay trước khi chụp bước này để bạn thao tác tay trong trình duyệt, bấm Enter trong terminal để chụp và đi tiếp. Dùng cùng `--headed` |
| `--section-name "<tên>"` | Ghi đè tên Section trên Figma cho lần chạy này |
| `--render <image\|layers>` | `image` (mặc định): ảnh phẳng. `layers`: layer chỉnh sửa được, xem [mục 7](#7-chế-độ-layers-frame-chỉnh-sửa-được) |
| `--auto-paste` | Chỉ dùng cùng `--render layers`: công cụ tự nhấn Ctrl+V trong Figma |
| `--config <file>` | File cấu hình khác với `capture.config.ts` |
| `--actor <tên>` | Chưa dùng được, xem [mục 14](#14-giới-hạn-hiện-tại) |

Điều cần biết khi chạy:

- Các luồng chạy lần lượt, không song song.
- Ảnh lưu ở `captures/<id luồng>/<NN>-<stepId>.png`. Mỗi lần chạy, thư mục của luồng đó bị xóa và ghi lại từ đầu.
- Luồng lỗi giữa chừng để lại `_loi.png` (ảnh màn hình lúc lỗi) và `_loi.log` trong thư mục của nó. Các luồng khác vẫn chạy tiếp, và lệnh thoát với mã khác 0.
- Cuối lệnh có bảng "Kết quả": `✔` xanh là hoàn tất, `✘` đỏ là dừng giữa chừng kèm lý do, rồi một dòng tổng số luồng, số màn và thời gian.
- Sau mỗi lần chạy, `captures/_last-run.json` ghi lại trạng thái từng luồng, danh sách ảnh, và đường dẫn ảnh, log lúc lỗi.
- Khi lệnh chạy trong script hay từ công cụ AI (không có terminal), phải chọn luồng bằng `--flow` hoặc `--all`; `.\capture` không kèm gì sẽ báo lỗi thay vì chạy mọi luồng. Đầu ra khi đó không có màu.
- Luồng có cảnh báo ⚠ (khai báo `caution`) chỉ chạy khi gọi đúng id. `--all`, `tiền-tố*` và "Tất cả luồng" trong menu bỏ qua nó và in ra một dòng thông báo.

Lệnh npm khác:

| Lệnh | Tác dụng |
| --- | --- |
| `npm run build:plugin` | Build plugin vào `plugin/dist` |
| `npm run server` | Chạy sẵn server trung chuyển ở cổng 8765 (không bắt buộc) |
| `npm run typecheck` | Kiểm tra kiểu cho CLI và plugin |

## 5. Cửa sổ plugin trong Figma

| Phần | Ý nghĩa |
| --- | --- |
| Kết nối | Chấm xanh: đã nối với server. Chấm đỏ "Chưa kết nối": chưa có server, plugin tự thử lại mỗi 2 giây; chỉ cần chạy `.\capture …` |
| Luồng / Đã dựng | Luồng đang nhận và số bước đã dựng |
| Lỗi / cảnh báo | Lỗi khi dựng, hoặc cảnh báo như không tìm thấy màu Section |
| Ghi đè luồng cũ | Mặc định. Chạy lại thì thay ảnh trong frame có cùng `stepId`; bước mới được chèn đúng vị trí; bước không còn trong luồng được giữ ở cuối với tiền tố `⚠ không còn trong luồng` để bạn tự quyết định xóa |
| Tạo section mới kèm thời gian | Luôn tạo Section mới tên `<tên luồng> · <ngày giờ>`, đặt dưới nội dung sẵn có. Dùng khi muốn giữ bản cũ để so sánh |
| Vẽ mũi tên giữa các bước | Chỉ có tác dụng khi `layout.arrows` trong `capture.config.ts` cũng là `true` (mặc định đang `false`) |
| Tô màu Section theo cấp | Xem [mục 6](#6-kết-quả-trên-figma) |
| Kết nối lại | Nối lại với server ngay |

Tùy chọn áp dụng cho luồng nhận kế tiếp. Giữ cửa sổ plugin mở suốt lúc lệnh chạy: đóng plugin giữa chừng thì luồng đang gửi báo lỗi.

## 6. Kết quả trên Figma

- **Vị trí.** Section mới được đặt trên page đang mở, bên dưới mọi nội dung đã có. Chọn đúng page trước khi chạy.
- **Tên frame** có dạng `<Tên sản phẩm> - <TÊN BƯỚC VIẾT HOA>`, ví dụ `SuperShip - NHẬP MÃ OTP`. Tên sản phẩm là `label` của app trong `capture.config.ts`; tên bước là `title` truyền cho `shot()`.
- **Kích thước frame** bằng kích thước màn hình thật (1440 × 900 với `desktop`); ảnh bên trong có độ phân giải gấp đôi.
- **Ảnh dài.** Figma chỉ nhận ảnh tối đa 4096 px mỗi chiều, nên ảnh dài được cắt thành nhiều lát xếp liền nhau trong cùng một frame.
- **Section cha.** Luồng khai báo `group` nằm trong một Section cha mang tên đó, cùng các luồng chung `group`, xếp dọc theo thứ tự chạy lần đầu. `group` nhiều phần tử thì lồng Section nhiều cấp.
- **Nhận diện.** Section và frame được nhận ra bằng `id` của luồng và `stepId` (lưu ẩn trong node), không theo tên. Bạn đổi tên hay kéo Section đi chỗ khác trên canvas thì lần chạy sau vẫn cập nhật đúng chỗ. Ngược lại, đổi `id` luồng hay `stepId` trong code là tạo Section hoặc frame mới.
- **Màu Section.** Khi bật "Tô màu Section theo cấp", Section ngoài cùng dùng màu `Section 2`, Section bên trong dùng `Section 3`, rồi `Section 4`… (cấp bắt đầu là `layout.colorFrom`). Plugin tìm biến màu hoặc paint style có tên, hoặc tên collection, chứa `Section <số>`: trong file trước, rồi tới các thư viện đang bật. Không tìm thấy thì giữ màu mặc định và liệt kê các tên màu đọc được ở dòng "Lỗi / cảnh báo".

## 7. Chế độ layers: frame chỉnh sửa được

Mặc định mỗi bước là một ảnh phẳng. Với `--render layers`, mỗi bước thành layer Figma chỉnh sửa được (chữ, khung, auto layout), nhờ chính script html-to-design của Figma.

Plugin không tự chuyển HTML thành layer được; chỉ ứng dụng Figma làm việc đó khi dán. Vì vậy mỗi màn cần một lần Ctrl+V.

### Dán tay

```powershell
.\capture --flow quen-mat-khau-sms-thanh-cong --render layers
```

1. Công cụ chạy hết các luồng đã chọn, lưu `NN-<stepId>.layers.html` cạnh file PNG. Chưa có gì sang Figma ở bước này.
2. Với từng màn, công cụ đưa dữ liệu lên clipboard, và plugin hiện khung vàng "Nhấn Ctrl+V trên canvas" kèm số thứ tự và tên màn.
3. Bạn bấm vào vùng trống trên canvas một lần, rồi nhấn Ctrl+V mỗi khi khung vàng đổi sang màn mới. Plugin nhận frame vừa dán, đặt tên và xếp vào đúng Section, đúng vị trí.
4. Nút "Bỏ qua màn này" bỏ một màn.

### Tự dán

```powershell
.\capture --flow "loi-moi-shop*" --render layers --auto-paste
```

Sau khi chụp xong, công cụ báo và chờ 8 giây: lúc đó bấm vào vùng trống trên canvas của Figma rồi để yên máy. Với mỗi màn, công cụ đưa cửa sổ Figma lên trước, nhấn Ctrl+V, chờ plugin báo đã nhận rồi mới sang màn sau.

- Phím chỉ được gửi khi cửa sổ Figma thật sự đang ở trên cùng, và không bao giờ gửi lần hai cho cùng một màn.
- Nếu không đưa được Figma lên trước, hoặc sau 20 giây Figma chưa nhận, công cụ nhắc bạn tự nhấn Ctrl+V và tiếp tục chờ.
- Đừng dùng máy vào việc khác trong lúc này: cửa sổ Figma liên tục bị kéo lên trước, và nếu con trỏ đang nằm trong một ô nhập của Figma thì cú dán sẽ vào ô đó thay vì canvas.
- Nếu ứng dụng không tên là "Figma" (ví dụ bản Beta), đặt biến môi trường `FFC_FIGMA_PROCESS` bằng tên tiến trình, ví dụ `$env:FFC_FIGMA_PROCESS = "Figma Beta"`.

### Cần biết

- Chỉ chạy trên Windows.
- Cần mạng tới `mcp.figma.com` để tải script chụp của Figma.
- Clipboard của máy bị thay nội dung trong lúc dán; đừng copy thứ khác cho tới khi xong.
- Trong lúc plugin đang chờ, đừng tạo hay dán thứ gì khác lên page: plugin coi node mới xuất hiện là màn đang chờ.
- Figma cần có font Open Sans, nếu không chữ bị thay font.
- Ô captcha để trống trong bản layer (widget Cloudflare nằm trong iframe khác nguồn, script không đọc được). Bản PNG vẫn có.
- Chạy lại một luồng ở chế độ nào thì frame của từng bước được thay bằng kết quả của chế độ đó.

## 8. Các luồng có sẵn

Hiện có 71 luồng, tất cả cho app `supership` ở viewport `desktop`. Xem danh sách đầy đủ bằng `.\capture --list`.

| Nhóm | Lệnh chạy cả nhóm | Số luồng | Số màn | Section cha trên Figma |
| --- | --- | --- | --- | --- |
| Đăng ký Shop (giả lập) | `--flow dang-ky-shop-mock` | 1 | 4 | Không có |
| Đăng ký Shop (backend thật) | `--flow dang-ky-shop` | 1 | 4 | Không có |
| Quên mật khẩu | `--flow "quen-mat-khau*"` | 11 | 71 | QUÊN MẬT KHẨU - ĐẶT LẠI MẬT KHẨU DÙNG OTP QUA SMS, và … QUA ZALO |
| Chấp nhận lời mời tham gia shop (chưa có tài khoản) | `--flow "loi-moi-shop*"` | 11 | 70 | CHẤP NHẬN LỜI MỜI THAM GIA SHOP (CHƯA CÓ TÀI KHOẢN) - XÁC THỰC OTP QUA SMS, và … QUA ZALO |
| Lời mời của tôi | `--flow "loi-moi-cua-toi*"` | 6 | 29 | LỜI MỜI THAM GIA CỦA TÔI |
| Xác thực email | `--flow "xac-thuc-email*"` | 3 | 14 | THÔNG TIN TÀI KHOẢN - XÁC THỰC EMAIL |
| Thông tin cửa hàng | `--flow "thong-tin-cua-hang*"` | 3 | 13 | THÔNG TIN CỬA HÀNG |
| Thành viên cửa hàng | `--flow "thanh-vien-shop*"` | 28 | 108 | THÀNH VIÊN CỬA HÀNG |
| Vai trò của shop | `--flow "vai-tro-shop*"` | 2 | 10 | QUẢN LÝ VAI TRÒ CỦA SHOP |
| Vai trò riêng của shop | `--flow "vai-tro-rieng*"` | 5 | 21 | VAI TRÒ RIÊNG CỦA SHOP |

Mọi nhóm trừ `dang-ky-shop` dùng backend giả lập: không tạo tài khoản hay cửa hàng, không gửi OTP, chạy lại bao nhiêu lần cũng được. Câu báo lỗi trong các nhánh thất bại được chép từ mã nguồn backend. Các luồng có ngày giờ hay bộ đếm ngược đều đứng đồng hồ của trang, nên ảnh giống nhau giữa các lần chạy.

### Đăng ký Shop

- `dang-ky-shop-mock`: API đăng ký và captcha được giả lập. Dùng cho việc chụp lại thường ngày.
- `dang-ky-shop`: chạy với backend dev thật. **Mỗi lần chạy tạo một tài khoản và Shop mới** và dùng một trong 50 OTP mỗi ngày. App local dùng sitekey Turnstile thật, nên phải chạy `--headed` và tự bấm captcha trong vòng 3 phút. Luồng này có cảnh báo ⚠ nên chỉ chạy khi gọi đúng `--flow dang-ky-shop`.

### Quên mật khẩu (`flows/quen-mat-khau/`)

Hai Section cha, mỗi kênh OTP một cái; trong mỗi cái có 5 Section con xếp dọc (`<kênh>` là `sms` hoặc `zalo`):

| Section con | id | Số màn |
| --- | --- | --- |
| 1. ĐẶT LẠI MẬT KHẨU THÀNH CÔNG | `quen-mat-khau-<kênh>-thanh-cong` | 9 |
| 2. GỬI LẠI OTP | `quen-mat-khau-<kênh>-gui-lai-otp` | 6 |
| 3. ĐỔI KÊNH NHẬN OTP | `quen-mat-khau-<kênh>-doi-kenh-nhan-otp` | 6 |
| 4. NHẬP SAI QUÁ SỐ LẦN QUY ĐỊNH | `quen-mat-khau-<kênh>-nhap-sai-qua-so-lan` | 5 |
| 5. HẾT PHIÊN OTP | `quen-mat-khau-<kênh>-het-phien-otp` | 6 |

Thêm một Section riêng không thuộc kênh nào, `quen-mat-khau-loi-nhap-lieu` (7 màn): số điện thoại sai định dạng, không tồn tại; mật khẩu chưa đạt, không khớp, trùng mật khẩu hiện tại; vượt giới hạn OTP trong ngày.

### Chấp nhận lời mời tham gia shop, người chưa có tài khoản (`flows/loi-moi-tham-gia-shop/`)

Cùng cấu trúc hai kênh như trên:

| Section con | id | Số màn |
| --- | --- | --- |
| 1. THAM GIA THÀNH CÔNG | `loi-moi-shop-<kênh>-thanh-cong` | 6 |
| 2. GỬI LẠI OTP | `loi-moi-shop-<kênh>-gui-lai-otp` | 6 |
| 3. ĐỔI KÊNH NHẬN OTP | `loi-moi-shop-<kênh>-doi-kenh-nhan-otp` | 6 |
| 4. NHẬP SAI QUÁ SỐ LẦN QUY ĐỊNH | `loi-moi-shop-<kênh>-nhap-sai-qua-so-lan` | 6 |
| 5. HẾT PHIÊN OTP | `loi-moi-shop-<kênh>-het-phien-otp` | 6 |

Thêm `loi-moi-shop-truong-hop-khac` (10 màn): lời mời hết hiệu lực, thông tin chưa hợp lệ, email đã được dùng, chưa gửi được mã, vượt giới hạn OTP, lời mời đóng khi đang tạo tài khoản, từ chối lời mời.

### Lời mời của tôi (`flows/loi-moi-cua-toi/`)

Mục "Lời mời" trên sidebar, trang `/settings/invitations`.

| id | Số màn |
| --- | --- |
| `loi-moi-cua-toi-xem` | 3 |
| `loi-moi-cua-toi-lich-su` | 3 |
| `loi-moi-cua-toi-chap-nhan` | 8 |
| `loi-moi-cua-toi-tu-choi` | 8 |
| `loi-moi-cua-toi-nhap-sai-otp` | 3 |
| `loi-moi-cua-toi-chap-nhan-that-bai` | 4 |

### Xác thực email (`flows/thong-tin-tai-khoan/`)

Trang "Thông tin tài khoản" (`/settings/profile`) của tài khoản có email chưa xác thực: `xac-thuc-email-thanh-cong` (5 màn), `xac-thuc-email-nhap-sai-ma` (3), `xac-thuc-email-gui-lai-ma` (6).

### Thông tin cửa hàng (`flows/thong-tin-cua-hang/`)

`thong-tin-cua-hang-xem` (2 màn, gồm cả thành viên chỉ có quyền xem), `thong-tin-cua-hang-cap-nhat` (7 màn: sửa tên, địa chỉ, chọn tỉnh và phường, lưu thành công), `thong-tin-cua-hang-nhap-thieu` (4 màn).

### Thành viên cửa hàng (`flows/thanh-vien-shop/`)

Tất cả nằm trong một Section cấp 1 **THÀNH VIÊN CỬA HÀNG**. Hai luồng chỉ xem đặt frame trực tiếp trong đó; các mảng còn lại là một Section cấp 2 chứa mỗi luồng một Section cấp 3. Chạy riêng một mảng bằng tiền tố, ví dụ `--flow "thanh-vien-shop-vai-tro*"`.

| Section trong THÀNH VIÊN CỬA HÀNG | Tiền tố id | Các luồng |
| --- | --- | --- |
| XEM DANH SÁCH VÀ TÌM KIẾM/LỌC THÀNH VIÊN | `thanh-vien-shop-danh-sach` | 1 luồng, 7 màn |
| XEM THÔNG TIN THÀNH VIÊN | `thanh-vien-shop-thong-tin` | 1 luồng, 5 màn |
| QUẢN LÍ TRẠNG THÁI TƯ CÁCH THÀNH VIÊN | `thanh-vien-shop-trang-thai` | Tạm khóa; kích hoạt lại; ngừng hoạt động |
| CHI TIẾT THÀNH VIÊN - TAB VAI TRÒ | `thanh-vien-shop-vai-tro` | Xem vai trò; chi tiết quyền trong vai trò; lịch sử; thêm vai trò; thêm thất bại do đã có vai trò; thu hồi vai trò |
| CHI TIẾT THÀNH VIÊN - TAB QUYỀN BỔ SUNG | `thanh-vien-shop-quyen-bo-sung` | Xem danh sách; chi tiết một quyền; cấp quyền; cấp thất bại do người cấp không có quyền đó; thu hồi quyền |
| CHI TIẾT THÀNH VIÊN - TAB QUYỀN BỊ THU HỒI | `thanh-vien-shop-quyen-bi-thu-hoi` | Xem danh sách; thu hồi quyền; khôi phục quyền |
| MỜI THÀNH VIÊN | `thanh-vien-shop-moi`, `thanh-vien-shop-loi-moi` | Mời thành viên mới; 3 trường hợp mời thất bại; danh sách lời mời đã gửi; thu hồi lời mời; thu hồi thất bại; gửi lại liên kết mời; gửi lại thất bại |

### Vai trò của shop và vai trò riêng

| id | Nội dung | Số màn |
| --- | --- | --- |
| `vai-tro-shop-xem-vai-tro` | Danh sách, chi tiết từng vai trò, tìm quyền | 6 |
| `vai-tro-shop-trang-thai-khac` | Chưa có vai trò, vai trò chưa có quyền, không có quyền xem, shop một người dùng | 4 |
| `vai-tro-rieng-tao` | Tạo vai trò riêng | 6 |
| `vai-tro-rieng-thieu-thong-tin` | Tạo thất bại do thiếu thông tin | 3 |
| `vai-tro-rieng-chinh-sua` | Đổi quyền của vai trò | 5 |
| `vai-tro-rieng-doi-ten` | Đổi tên và mô tả | 4 |
| `vai-tro-rieng-trang-thai-khac` | Vai trò chưa có quyền, không được đổi tên, không có quyền tạo | 3 |

## 9. Viết một luồng mới

### Các bước

1. Tạo `flows/<tên>.flow.ts`. Không cần đăng ký ở đâu: CLI tự quét mọi file `*.flow.ts` trong `flows/` và thư mục con, bỏ qua thư mục hoặc file có tên bắt đầu bằng `_` hay `.`.

   ```ts
   import { defineFlow } from "../capture";

   export default defineFlow({
     id: "quen-mat-khau",
     name: "Quên mật khẩu",
     app: "supership",
     async run({ page, shot }) {
       await page.goto("/forgot-password");
       await page.getByLabel("Số điện thoại", { exact: true }).waitFor();
       await shot("nhap-sdt", "Nhập số điện thoại");
       // thao tác Playwright tiếp theo, rồi shot() ở mỗi màn cần chụp
     },
   });
   ```

2. Để có sẵn code thao tác, ghi lại bằng `npx playwright codegen http://localhost:3001`, dán vào `run` rồi chèn `shot()`.
3. Trước mỗi `shot()`, chờ một dấu hiệu cụ thể của màn hình (`locator.waitFor()`). Đừng chờ network idle: app còn request nền.
4. Chạy thử có mở trình duyệt: `.\capture --flow quen-mat-khau --no-figma --headed`.
5. Ảnh đã đúng thì bỏ `--no-figma` để gửi sang Figma.

`page.goto("/đường-dẫn")` dùng đường dẫn tương đối: địa chỉ gốc lấy từ `baseUrl` của app. Trình duyệt chạy với ngôn ngữ `vi-VN` và múi giờ `Asia/Ho_Chi_Minh`.

Một file có thể `export default` một mảng luồng, ví dụ cùng một hành trình cho từng kênh OTP. `id` phải duy nhất trong toàn bộ `flows/`; trùng thì CLI báo lỗi ngay.

### `defineFlow`

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Duy nhất; chỉ gồm chữ thường, số, gạch ngang. Là khóa của Section trên Figma: đổi id là tạo Section mới |
| `name` | Tên Section |
| `app` | Tên app trong `capture.config.ts` (`supership` → :3001, `superplatform` → :3000) |
| `run(ctx)` | Nội dung luồng. `ctx` gồm `page`, `context` (của Playwright), `shot`, `data`, `app`, `viewport`, `log` |
| `viewports?` | Ví dụ `["desktop", "mobile"]`; mỗi viewport là một Section riêng, tên kèm ` · mobile`. Mặc định `desktop` |
| `group?` | `"TÊN"` đặt luồng vào Section cha tên đó. `["CẤP 1", "CẤP 2"]` lồng nhiều cấp, từ ngoài vào trong |
| `sectionName?` | Tên Section khác với `name` |
| `caution?` | Hậu quả thật của luồng ngoài trình duyệt, ví dụ "tạo tài khoản thật". Luồng có trường này chỉ chạy khi gọi đúng id |
| `actor?` | Chưa dùng được, xem [mục 14](#14-giới-hạn-hiện-tại) |

### `shot(stepId, title, options?)`

Thứ tự bước là thứ tự gọi. `stepId` (chữ thường, số, gạch ngang; không trùng trong một luồng) là khóa của frame trên Figma: giữ nguyên để lần chạy sau thay ảnh đúng frame. `title` thành tên frame.

| Option | Ý nghĩa |
| --- | --- |
| `mode` | `"viewport"` (mặc định, đúng phần người dùng đang thấy, giữ nguyên modal và lớp phủ), `"fullPage"` (cả trang), `"element"` (một phần tử) |
| `target` | Phần tử cần chụp khi `mode: "element"`: selector hoặc Locator |
| `code` | Mã giao diện, ví dụ `"TK-02"`; hiện trong tên frame |
| `hide` | Selector cần ẩn thêm cho riêng bước này |
| `mask` | Phần tử cần che bằng ô đặc (dữ liệu nhạy cảm) |
| `delayMs` | Chờ thêm trước khi chụp |

Trước mỗi lần chụp, công cụ tự làm các việc sau, bạn không cần viết:

- Chờ font và ảnh tải xong; tắt animation và con trỏ nháy.
- Chờ widget captcha trên trang xác minh xong.
- Ẩn các lớp phủ dev của app (nút Figma, nhật ký debug, "Tài khoản test", "Tự điền dữ liệu mẫu", chỉ báo Next.js) rồi hiện lại ngay sau khi chụp, nên luồng vẫn bấm được chúng. Danh sách ở `hide` trong `capture.config.ts`.
- Với `mode: "fullPage"`, nếu nội dung cuộn bên trong một khung (như phần nội dung của giao diện sau đăng nhập), tạm kéo dài cửa sổ trình duyệt cho vừa nội dung, nên ảnh có đủ cả trang.

### Helper có sẵn

| Helper | File | Dùng để |
| --- | --- | --- |
| `data.phone()`, `data.email()`, `data.digits(n)`, `data.pick(list)` | `ctx.data` | Dữ liệu ngẫu nhiên cho luồng tạo bản ghi |
| `waitEnabled(locator)` | `flows/_helpers/wait.ts` | Chờ nút hết bị khóa |
| `freezeTime(page, at?)` | `flows/_helpers/wait.ts` | Đứng đồng hồ của trang để bộ đếm ngược và ngày giờ giống nhau ở mọi lần chạy |
| `mockTurnstile(page, mode?)` | `flows/_helpers/turnstile.ts` | Cho captcha tự qua ở luồng dùng backend giả lập |
| `mockSignedInShop(page, shop, permissions, log)` | `flows/_helpers/supership-session.ts` | Phiên đã đăng nhập và backend giả lập cho các trang sau đăng nhập |
| `fillRegisterForm`, `openOtpChannelDialog`, `requestOtp`, `submitOtp`, `mockRegisterApi` | `flows/_helpers/supership-register.ts` | Các bước của màn đăng ký Shop |
| `DEV_OTP`, `OtpSessionMock` | `flows/_helpers/otp-session.ts` | Phiên OTP giả lập: gửi lại, hết hạn, nhập sai quá số lần |

Mỗi nhóm luồng có một file helper riêng trong `flows/_helpers/` (`supership-shop-members.ts`, `supership-own-roles.ts`, `supership-shop-info.ts`…), kèm một hàm bọc như `memberFlow`, `ownRolesFlow`, `shopInfoFlow` đã gắn sẵn tiền tố id, `group` và backend giả lập. Thêm luồng vào nhóm đã có thì dùng hàm bọc đó; xem các file `*.flow.ts` cùng thư mục làm mẫu.

### Captcha

App local dùng sitekey Cloudflare Turnstile thật, mà trình duyệt tự động không qua được captcha thật. Gọi `mockTurnstile(page)` trước `page.goto()`:

- `"visible"` (mặc định): vẫn tải widget thật của Cloudflare nhưng ép dùng sitekey thử nghiệm chính thức (luôn pass), nên ô captcha có trong ảnh ở trạng thái "Thành công!". Cần mạng tới `challenges.cloudflare.com`, và đồng hồ của trang phải đúng giờ thật: đóng băng ở giờ hiện tại thì được, đặt về ngày khác thì widget không xác minh.
- `"hidden"`: thay widget bằng bản giả chỉ trả token, không vẽ gì. Chạy được khi không có mạng; ô captcha để trống trong ảnh.

Cả hai chỉ dùng cho luồng có backend giả lập: backend thật từ chối token này.

### Trang sau đăng nhập

Backend local kiểm tra captcha thật nên không tự động đăng nhập được. Thay vào đó, `mockSignedInShop` trao cho tab một phiên có sẵn và trả lời mọi lời gọi `/api/backend/**` ngay trong trình duyệt. Gọi nó trước `page.goto()` đầu tiên.

```ts
import { KHA_AI_SHOP, mockSignedInShop } from "./_helpers/supership-session";

const backend = await mockSignedInShop(page, KHA_AI_SHOP, ["order.view"], log);
backend.on("GET", /^\/v1\/orders$/, () => ({ data: { items: [] } }));
backend.on("POST", /^\/v1\/orders$/, () => ({ status: 409, code: "ORDER_EXISTS", message: "Đơn hàng đã tồn tại." }));
```

- `backend.on(method, /đường-dẫn/, handler)` thêm hoặc thay câu trả lời cho một API; handler khai báo sau thắng handler trước.
- `backend.setPermissions([...])` đổi quyền của người đang đăng nhập, có hiệu lực từ lần tải trang kế tiếp.
- Lời gọi nào chưa được giả lập nhận 404 và được in ra dạng `chưa giả lập: GET /v1/…` để bạn bổ sung.

## 10. Cấu hình

### `capture.config.ts`

| Mục | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `apps` | `supership`, `superplatform` | Tên app → `baseUrl`, `label` (tên sản phẩm đứng đầu tên frame) và `sourceDir` (thư mục mã nguồn app, chỉ để đọc khi viết luồng) |
| `backendSourceDir` | `../Server` | Thư mục mã nguồn backend, nơi chép câu báo lỗi cho backend giả lập |
| `viewports` | `desktop` 1440 × 900, `mobile` 390 × 844 | Kích thước màn hình |
| `defaultViewport` | `desktop` | Viewport của luồng không khai báo `viewports` |
| `deviceScaleFactor` | `2` | Độ nét của ảnh |
| `hide` | Các lớp phủ dev | Selector Playwright bị ẩn ở mọi lần chụp |
| `blockUrls` | `**://mcp.figma.com/**` | Các URL không bao giờ được tải trong trang |
| `locale`, `timezoneId` | `vi-VN`, `Asia/Ho_Chi_Minh` | Ngôn ngữ và múi giờ của trình duyệt |
| `outputDir` | `captures` | Thư mục lưu ảnh |
| `figma.pluginTimeoutMs` | `120000` | Thời gian chờ plugin kết nối |
| `layout.gap` | `320` | Khoảng cách giữa hai frame |
| `layout.padding` | `240` | Lề trong của Section |
| `layout.headroom` | `200` | Khoảng trống phía trên để tên Section không đè lên tên frame |
| `layout.rowGap` | `400` | Khoảng cách giữa các Section xếp dọc trong một Section cha |
| `layout.sectionGap` | `800` | Khoảng cách giữa Section mới và nội dung đã có trên page |
| `layout.arrows` | `false` | Vẽ mũi tên giữa các frame |
| `layout.colorFrom` | `2` | Cấp màu của Section ngoài cùng |

Cổng 8765 được ghi cứng trong plugin và `plugin/manifest.json`. Đừng đổi `figma.port`, trừ khi sửa cả hai chỗ đó rồi build lại plugin.

### Biến môi trường

Sao chép `.env.example` thành `.env` (file này không vào git). Tất cả đều không bắt buộc.

| Biến | Ý nghĩa |
| --- | --- |
| `SUPERSHIP_URL` | Địa chỉ SuperShip Web khi không chạy ở `http://localhost:3001` |
| `SUPERPLATFORM_URL` | Địa chỉ SuperPlatform khi không chạy ở `http://localhost:3000` |
| `SUPERSHIP_SRC`, `SUPERPLATFORM_SRC` | Thư mục mã nguồn của app, khi không nằm ở `../SuperShip UI`, `../SuperPlatform UI` |
| `BACKEND_SRC` | Thư mục mã nguồn backend, khi không nằm ở `../Server` |
| `FFC_FIGMA_PROCESS` | Tên tiến trình của Figma cho `--auto-paste`, khi không phải `Figma` |

## 11. Kiểm tra công cụ khi không có app

```powershell
npm run test:relay               # server và việc cắt/ghép ảnh; không cần Figma
npm run test:send                # gửi 3 ảnh cố định vào Figma (cần mở plugin)
npx tsx scripts/fake-plugin.ts   # plugin giả, để thử CLI khi không có Figma
```

`npm run test:send` là cách nhanh nhất để biết plugin và kết nối có hoạt động không, trước khi nghi ngờ app hay luồng.

## 12. Lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
| --- | --- |
| Menu hiện ra dù đã truyền `--flow` | Đang dùng `npm run capture -- …` trong PowerShell. Dùng `.\capture …` |
| Chữ tiếng Việt trong terminal bị lệch dấu (`muốn`, `luồng`) | Font của terminal thiếu chữ tiếng Việt. Đổi sang font có đủ, ví dụ Cascadia Mono hoặc Consolas (VS Code: `terminal.integrated.fontFamily`) |
| `Không có luồng nào khớp "…"` | Sai id, hoặc quên dấu `*` khi chọn theo tiền tố. Chạy `.\capture --list` |
| `net::ERR_CONNECTION_REFUSED` ngay bước đầu | App chưa chạy, hoặc chạy ở cổng khác. Bật app, hoặc đặt `SUPERSHIP_URL` trong `.env` |
| `browserType.launch: Executable doesn't exist` | Chạy `npx playwright install chromium` |
| `Plugin Figma không kết nối sau 120 giây` | Plugin chưa mở, hoặc đang mở Figma trên trình duyệt. Mở plugin trong Figma desktop, bấm "Kết nối lại" |
| Plugin báo "Chưa kết nối" | Chưa có server: chạy `.\capture …` hoặc `npm run server`; plugin tự nối lại |
| Figma báo lỗi khi import hoặc mở plugin | Chưa có `plugin/dist`: chạy `npm run build:plugin` rồi mở lại plugin |
| `Plugin Figma đã ngắt kết nối giữa chừng` | Cửa sổ plugin bị đóng trong lúc chạy. Mở lại plugin rồi chạy lại luồng |
| Section hiện ở page khác với mong muốn | Plugin dựng trên page đang mở lúc chạy. Kéo Section sang page đúng, hoặc chọn page trước khi chạy |
| `Phần tử vẫn bị khóa … 'Nhận mã OTP'` | Captcha chưa qua. Luồng giả lập: gọi `mockTurnstile(page)` trước khi mở trang và kiểm tra mạng tới Cloudflare (hoặc dùng chế độ `"hidden"`). Luồng thật: chạy `--headed` và bấm captcha |
| Luồng đứng ở một bước rồi timeout | Nhãn hoặc cấu trúc màn hình của app đã đổi. Xem `_loi.png` và `_loi.log` trong `captures/<id luồng>/`, sửa locator trong file luồng. Chạy lại với `--headed` để xem tận mắt |
| Terminal in `chưa giả lập: GET /v1/…` | App gọi một API mà luồng chưa giả lập. Thêm `backend.on(...)` cho API đó |
| Không tìm thấy màu "Section N" (dòng cảnh báo của plugin) | File Figma chưa có biến màu hay style tên chứa `Section N`. Tạo màu đó, bật thư viện chứa nó, hoặc bỏ chọn "Tô màu Section theo cấp" |
| Chế độ layers: chữ bị đổi font | Cài font Open Sans cho Figma |
| `--auto-paste`: Figma không nhận cú dán | Bấm vào vùng trống trên canvas rồi tự nhấn Ctrl+V; công cụ vẫn đang chờ |

## 13. Cấu trúc thư mục

| Đường dẫn | Nội dung |
| --- | --- |
| `setup.cmd` | Lệnh `.\setup`: cài đặt một lần sau khi lấy code |
| `capture.cmd` | Lệnh `.\capture` |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Hướng dẫn, quy trình và quyền lệnh cho công cụ AI |
| `capture.config.ts` | Cấu hình chung: app, viewport, phần tử ẩn, bố cục trên Figma |
| `capture/` | CLI: đọc cấu hình, tìm luồng, chạy Playwright, cắt ảnh, gửi sang Figma, chế độ layers |
| `flows/` | Các luồng (`*.flow.ts`), chia thư mục theo nhóm |
| `flows/_helpers/` | Code dùng chung của các luồng: backend giả lập, captcha, phiên đăng nhập |
| `plugin/` | Plugin Figma: `src/` là mã nguồn, `dist/` là bản build, `manifest.json` để import |
| `server/` | Server trung chuyển WebSocket giữa CLI và plugin |
| `shared/types.ts` | Định dạng tin nhắn giữa CLI, server và plugin |
| `scripts/` | Build plugin và các script tự kiểm tra |
| `captures/` | Ảnh đầu ra (không vào git) |

## 14. Giới hạn hiện tại

- Chưa hỗ trợ đăng nhập theo `actor` (tự đăng nhập, lưu và dùng lại phiên). Luồng khai báo `actor` bị từ chối với thông báo rõ ràng. Các trang sau đăng nhập hiện dùng `mockSignedInShop`.
- Plugin chỉ chạy trên Figma desktop.
- Chế độ layers và lệnh `.\capture` chỉ chạy trên Windows.
- Chưa có luồng nào cho app `superplatform` hay viewport `mobile`; cấu hình đã sẵn, chỉ cần viết luồng.
