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
   - [Giao diện web: xem ảnh và gửi sang Figma](#giao-diện-web-xem-ảnh-và-gửi-sang-figma)
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

### Giao diện web: xem ảnh và gửi sang Figma

```powershell
.\web
```

Mở trang `http://127.0.0.1:4646` trên trình duyệt (Ctrl+C trong terminal để tắt). Trang đọc thẳng thư mục `captures/`, không chạy lại luồng nào khi chỉ xem hay gửi:

- **Cột trái**: mọi luồng, xếp theo thư mục của `flows/` như `--list`, kèm số ảnh và dấu "Lỗi" nếu lần chụp gần nhất chưa hoàn tất. Ô tìm kiếm lọc theo tên, id, tên Section; phím `/` để nhảy vào ô tìm.
- **Bên phải**: ảnh của luồng đang mở, đúng thứ tự bước, mỗi ảnh kèm tên bước và tên frame sẽ có trên Figma. Bấm ảnh để xem to, dùng ← → để chuyển bước.
- **Gửi sang Figma**: tích chọn nhiều luồng (hoặc cả nhóm), rồi bấm "Gửi sang Figma" ở thanh dưới. Nút chỉ bấm được khi góc trên báo "Plugin Figma đã kết nối": mở Figma desktop → Plugins → Development → Flow Capture và giữ cửa sổ plugin mở. Ghi đè hay tạo Section mới vẫn chọn trong cửa sổ plugin.
- **Chụp lại**: chạy lại các luồng đã chọn như `.\capture --flow <id> --no-figma`, chỉ lưu ra đĩa; xong thì trang tự đọc lại ảnh. Luồng có cảnh báo ⚠ không chụp từ trang này.

Trang dùng chung server trung chuyển ở cổng 8765 với CLI: chưa có thì tự khởi động. Vì vậy đừng tắt trang trong lúc một lệnh `.\capture` khác đang gửi sang Figma, lệnh đó sẽ mất kết nối. Đổi cổng của trang bằng biến `FFC_WEB_PORT`.

Tên bước được lưu vào `captures/<luồng>/_steps.json` mỗi lần chụp. Ảnh chụp trước khi có file này lấy tên từ mã luồng; tên dựng lúc chạy (ví dụ có kênh SMS/Zalo) thì không lấy được, trang đánh dấu "tên tạm" và frame mang tên theo `stepId`. Chụp lại luồng đó để có đúng tên.

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

Các luồng bên dưới dùng app `supership` hoặc `superplatform` ở viewport `desktop`. Xem danh sách đầy đủ bằng `.\capture --list`.

| Nhóm | Lệnh chạy cả nhóm | Số luồng | Số màn | Section cha trên Figma |
| --- | --- | --- | --- | --- |
| Đăng ký Shop (giả lập) | `--flow dang-ky-shop-mock` | 1 | 4 | Không có |
| Đăng ký Shop (backend thật) | `--flow dang-ky-shop` | 1 | 4 | Không có |
| Quên mật khẩu | `--flow "quen-mat-khau*"` | 11 | 72 | QUÊN MẬT KHẨU - ĐẶT LẠI MẬT KHẨU DÙNG OTP QUA SMS, và … QUA ZALO |
| Chấp nhận lời mời tham gia shop (chưa có tài khoản) | `--flow "loi-moi-shop*"` | 11 | 70 | CHẤP NHẬN LỜI MỜI THAM GIA SHOP (CHƯA CÓ TÀI KHOẢN) - XÁC THỰC OTP QUA SMS, và … QUA ZALO |
| Lời mời của tôi | `--flow "loi-moi-cua-toi*"` | 6 | 29 | LỜI MỜI THAM GIA CỦA TÔI |
| Xác thực email | `--flow "xac-thuc-email*"` | 3 | 14 | THÔNG TIN TÀI KHOẢN - XÁC THỰC EMAIL |
| Thông tin cửa hàng | `--flow "thong-tin-cua-hang*"` | 3 | 13 | THÔNG TIN CỬA HÀNG |
| Thành viên cửa hàng | `--flow "thanh-vien-shop*"` | 28 | 108 | THÀNH VIÊN CỬA HÀNG |
| Vai trò của shop | `--flow "vai-tro-shop*"` | 2 | 10 | QUẢN LÝ VAI TRÒ CỦA SHOP |
| Vai trò riêng của shop | `--flow "vai-tro-rieng*"` | 5 | 21 | VAI TRÒ RIÊNG CỦA SHOP |
| Khóa màn hình bằng PIN — SuperPlatform | `--flow "superplatform-pin*"` | 29 | 88 | SUPERPLATFORM → KHÓA MÀN HÌNH BẰNG MÃ PIN |
| Chính sách tự đăng xuất — SuperPlatform | `--flow "superplatform-idle-policy*"` | 9 | 40 | SUPERPLATFORM → CHÍNH SÁCH TỰ ĐĂNG XUẤT |
| Chính sách khóa đăng nhập (theo IP) — SuperPlatform | `--flow "superplatform-login-lockout*"` | 5 | 16 | SUPERPLATFORM → CHÍNH SÁCH KHÓA ĐĂNG NHẬP |
| Khóa màn hình bằng PIN — SuperShip Web (trường hợp chính) | `--flow "supership-pin*"` | 9 | 27 | SUPERSHIP WEB → KHÓA MÀN HÌNH BẰNG MÃ PIN |
| Xác thực định danh (CCCD) — SuperPlatform | `--flow "superplatform-cccd*"` | 11 | 40 | SUPERPLATFORM → XÁC THỰC ĐỊNH DANH (CCCD) |
| Quên mật khẩu nội bộ — SuperPlatform | `--flow "superplatform-quen-mat-khau*"` | 11 | 37 | SUPERPLATFORM → QUÊN MẬT KHẨU NỘI BỘ |
| Đăng nhập — SuperPlatform (8 nhóm con, xem bên dưới) | `--flow "superplatform-dang-nhap*"` | 59 | 188 | SUPERPLATFORM → ĐĂNG NHẬP → 8 Section con |
| Hồ sơ của tôi — SuperPlatform (4 nhóm con, xem bên dưới) | `--flow "superplatform-ho-so-cua-toi*"` | 30 | 104 | SUPERPLATFORM → HỒ SƠ CỦA TÔI → 4 Section con |
| Nhượng quyền và bưu cục — SuperPlatform (10 nhóm con, xem bên dưới) | xem [mục bên dưới](#nhượng-quyền-và-bưu-cục--superplatform-flowssuperplatform-nhuong-quyen-buu-cuc) | 73 | | SUPERPLATFORM — NHƯỢNG QUYỀN VÀ BƯU CỤC → 01 … 10 |

Mọi nhóm trừ `dang-ky-shop` dùng backend giả lập: không tạo tài khoản hay cửa hàng, không gửi OTP, chạy lại bao nhiêu lần cũng được. Câu báo lỗi trong các nhánh thất bại được chép từ mã nguồn backend. Các luồng có ngày giờ hay bộ đếm ngược đều đứng đồng hồ của trang, nên ảnh giống nhau giữa các lần chạy.

### Chính sách tự đăng xuất — SuperPlatform (`flows/superplatform-idle-policy/`)

Trang `/workspace/security-policies`, thẻ **Tự đăng xuất**, viewport desktop 1440 × 900, ảnh 2×. Phiên quản trị, quyền, tổ chức, chính sách và MFA được giả lập; không sửa chính sách thật. Chụp theo giao diện hiện tại: chọn tổ chức và số phút → Lưu → hộp MFA dùng chung → cập nhật danh sách. Không gồm lỗi mạng hoặc lỗi hạ tầng.

| id (tiền tố `superplatform-idle-policy-`) | Nội dung | Số màn |
| --- | --- | --- |
| `dat-moi` | Mặc định 30 phút, form, tìm tổ chức, nhập 10 phút, MFA, lưu và áp cấp dưới | 6 |
| `chi-to-chuc` | Đặt 15 phút cho nhượng quyền và bỏ áp cấp dưới, MFA, kết quả | 3 |
| `nhap-lieu` | Chưa chọn tổ chức; không tìm thấy; Shop bị loại; thiếu số phút; dưới/trên giới hạn; số lẻ; hai biên 5/30 phút; đổi tổ chức | 10 |
| `huy` | Hủy form; hủy MFA và giữ thông tin, không lưu | 4 |
| `sua` | Danh sách; điền sẵn; đổi thời gian và phạm vi; MFA; thay dòng cũ | 5 |
| `ma-du-phong` | Mã thiếu; mã sai hoặc đã sử dụng; chọn mã dự phòng; lưu thành công | 4 |
| `go` | Danh sách; xác nhận; hủy; MFA; gỡ và trở về mặc định | 5 |
| `chi-xem` | Có quyền xem nhưng các nút đặt, sửa, gỡ bị khóa | 1 |
| `chua-mfa` | Yêu cầu thiết lập MFA; đóng yêu cầu và giữ form chưa lưu | 2 |

Chụp kiểm tra: `.\capture --flow "superplatform-idle-policy*" --no-figma`. Sau khi xem ảnh, mở đúng page trong Figma desktop và plugin Flow Capture rồi chạy lại lệnh bỏ `--no-figma` để nhập ảnh vào các Section.

### Chính sách khóa đăng nhập — SuperPlatform (`flows/superplatform-login-lockout/`)

Trang `/workspace/security-policies?tab=login-lockout`, thẻ **Khóa đăng nhập**: nhập sai mật khẩu bao nhiêu lần thì khóa đăng nhập bằng mật khẩu từ IP đó, khóa bao lâu. Phiên, quyền, chính sách và hộp **Xác nhận thao tác** được giả lập; câu báo chép từ backend (3–20 lần, 1–1440 phút, mặc định 5 lần và 15 phút).

| id (tiền tố `superplatform-login-lockout-`) | Nội dung | Số màn |
| --- | --- | --- |
| `sua` | Mặc định; hộp sửa; nhập 10 lần, 90 phút và lý do; mã xác thực; đã lưu (1 giờ 30 phút, người sửa, phiên bản) | 5 |
| `gioi-han` | Dưới/trên giới hạn số lần và số phút; thiếu lý do; hai biên hợp lệ 3 lần, 1440 phút | 6 |
| `huy-xac-nhan` | Mã xác thực sai; đóng hộp xác nhận, giữ số đã nhập, chưa lưu | 2 |
| `nguoi-khac-sua` | Người khác vừa lưu trước; tải lại thấy chính sách mới | 2 |
| `chi-xem` | Chỉ có quyền xem: không có nút Sửa | 1 |

### Xác thực định danh (CCCD) — SuperPlatform (`flows/superplatform-cccd/`)

Trang `/workspace/account/identity-document` (Tài khoản của tôi › Giấy tờ định danh), viewport desktop 1440 × 900, ảnh 2×. Phiên, đồng ý, giấy tờ, bước đọc thẻ (`card-check`), kết quả eKYC, danh mục địa chỉ (`/api/address`) và hộp mã xác thực (step-up, chỉ còn ở lưu nơi ở) được giả lập; không gọi VNPT. Từ 27/10/2026 hai mặt thẻ được đọc ngay khi bấm **Tiếp tục** ở mặt sau: đọc được thì có bước **Thông tin** để xác nhận trước khi chụp khuôn mặt; thẻ bị từ chối (hết hạn, số đã dùng, khác số) hiện hộp lỗi chung **Chưa xác thực được** trên hộp xác thực rồi về bước mặt trước; gửi khuôn mặt không còn hỏi mã xác thực. Camera được thay bằng cảnh vẽ sẵn: camera sau quay một thẻ căn cước mẫu, camera trước quay một khuôn mặt minh họa. Câu báo kết quả chép từ `IdentityDocumentImageService`. Mỗi luồng chỉ chụp các màn chính. Chưa gồm chế độ "Quét tự động" (thử nghiệm, cần SDK VNPT).

| id (tiền tố `superplatform-cccd-`) | Nội dung | Số màn |
| --- | --- | --- |
| `thanh-cong` | Chưa xác thực; đồng ý; chụp mặt trước, mặt sau; kiểm tra thông tin đọc từ thẻ; khuôn mặt; kết quả; trang đã xác thực | 10 |
| `tai-anh` | Không mở được camera; hướng dẫn chụp; tải ảnh; ảnh quá nhỏ; đã chọn ảnh | 5 |
| `chup-lai` | Chưa đọc rõ mặt trước khi đọc thẻ (về bước 1, trước khuôn mặt); chưa thấy rõ khuôn mặt | 2 |
| `khuon-mat-khong-dat` | Khuôn mặt không khớp (còn 4 lần); không phải người thật | 2 |
| `tam-khoa` | Sai lần cuối → tạm khóa; trang đang tạm khóa | 2 |
| `tu-choi` | Căn cước hết hạn; số căn cước đã được dùng (hộp lỗi chung ngay sau bước mặt sau) | 2 |
| `xac-thuc-lai` | Xác nhận xác thực lại; thẻ khác số (hộp lỗi chung); về bước 1 chọn lại ảnh; đúng thẻ — kiểm tra thông tin; đã xác thực lại | 5 |
| `het-han` | Sắp hết hạn; đã hết hạn | 2 |
| `noi-o` | Giống thường trú; nơi khác thiếu thông tin; đã nhập; mã xác thực; đã cập nhật | 5 |
| `rut-dong-y` | Xác nhận ngừng cho phép dùng ảnh; ảnh đã xóa | 2 |
| `loi-he-thong` | Chức năng chưa sẵn sàng; lỗi tải trang; hệ thống xác thực đang bận | 3 |

Bước cũ không còn (27/10/2026): `ma-xac-thuc` của `thanh-cong` (gửi khuôn mặt không còn hỏi mã) sẽ hiện ở cuối Section với tiền tố `⚠ không còn trong luồng`.

Tạo trang xem trước toàn bộ ảnh: `python scripts/preview-idle-policy.py` (cần Pillow). Mở `captures/idle-policy-preview/index.html`; nhấp một ảnh để xem PNG đầy đủ.

### Nhượng quyền và bưu cục — SuperPlatform (`flows/superplatform-nhuong-quyen-buu-cuc/`)

Mọi luồng về nhượng quyền và bưu cục nằm trong một Section cha **SUPERPLATFORM — NHƯỢNG QUYỀN VÀ BƯU CỤC**, chia thành 10 Section con đánh số theo thứ tự nghiệp vụ. Tên Section khai báo một chỗ ở `flows/_helpers/superplatform-franchise-sections.ts`; thư mục con mang cùng số nên Section con được dựng theo đúng thứ tự. Không gồm luồng lỗi mạng.

| Section con | Thư mục | Tiền tố id | Số luồng |
| --- | --- | --- | --- |
| 01. DANH SÁCH TỔ CHỨC | `01-danh-sach` | `superplatform-danh-sach-` | 8 |
| 02. THÊM ĐỐI TÁC NHƯỢNG QUYỀN | `02-them-nhuong-quyen` | `superplatform-nhuong-quyen-` | 7 |
| 03. MỞ BƯU CỤC | `03-mo-buu-cuc` | `superplatform-buu-cuc-` | 5 |
| 04. HỒ SƠ TỔ CHỨC | `04-ho-so` | `superplatform-ho-so-` | 7 |
| 05. THÔNG TIN PHÁP LÝ | `05-phap-ly` | `superplatform-phap-ly-` | 13 |
| 06. NGƯỜI ĐẠI DIỆN | `06-nguoi-dai-dien` | `superplatform-nguoi-dai-dien-` | 10 |
| 07. LIÊN HỆ CỦA TỔ CHỨC | `07-lien-he` | `superplatform-lien-he-` | 6 |
| 08. ĐỊA CHỈ CỦA TỔ CHỨC | `08-dia-chi` | `superplatform-dia-chi-` | 5 |
| 09. ĐỔI LOẠI HÌNH BƯU CỤC | `09-loai-hinh` | `superplatform-loai-hinh-` | 4 |
| 10. TẠM NGƯNG, KÍCH HOẠT LẠI, NGỪNG HOẠT ĐỘNG | `10-trang-thai` | `superplatform-trang-thai-` | 8 |

Chạy cả 73 luồng theo đúng thứ tự (bỏ `--no-figma` để gửi sang Figma):

```powershell
.\capture --no-figma --flow "superplatform-danh-sach-*" --flow "superplatform-nhuong-quyen-*" --flow "superplatform-buu-cuc-*" --flow "superplatform-ho-so-*" --flow "superplatform-phap-ly-*" --flow "superplatform-nguoi-dai-dien-*" --flow "superplatform-lien-he-*" --flow "superplatform-dia-chi-*" --flow "superplatform-loai-hinh-*" --flow "superplatform-trang-thai-*"
```

Luồng đã bỏ: `superplatform-buu-cuc-mat-ket-noi`, `superplatform-danh-sach-loi-tai` (lỗi mạng).

#### 02, 03. Thêm đối tác nhượng quyền, mở bưu cục

Hai trang riêng, viewport desktop 1440 × 900, ảnh 2×, đồng hồ trang dừng ở 12/10/2026:

- **Thêm đối tác nhượng quyền:** Danh sách tổ chức `/workspace/organizations` (thẻ Nhượng quyền) → nút **Thêm đối tác nhượng quyền** → `/workspace/organizations/new/franchise`, năm mục 01–05 (thông tin chung, pháp lý theo hình thức, người đại diện theo pháp luật, liên hệ, văn phòng giao dịch) → hộp kiểm tra lại → mã xác thực → trang nhượng quyền mới. API `POST /v1/franchises`.
- **Mở bưu cục:** trang nhượng quyền → thẻ **Bưu cục** → nút **Mở bưu cục** → `/workspace/organizations/{nhượng quyền}/post-offices/new`, bốn mục 1–4 và khung "Bưu cục mới" → hộp kiểm tra lại → mã xác thực → trang bưu cục mới. API `POST /v1/franchises/{id}/post-offices`.

Phiên, quyền, danh mục (`creation-options`, `post-office-creation-options`), tỉnh/xã, danh sách, hộp mã xác thực và kết quả đều giả lập; không tạo đơn vị thật. Danh mục và câu báo chép từ `CreationOptionsService`, `LegalProfileRules`, `RepresentativeEntryRules`, `CompanyEmailDomainRules`, `OperationalCreationSupport`, `MfaUnitOfWork` và `creation-form.ts` của web. Mặc định chỉ Quản trị hệ thống có `organization.franchise.create`, `organization.post_office.create`; Quản lý nhượng quyền không mở được bưu cục (luồng `quan-ly-khong-co-quyen`).

| id (tiền tố `superplatform-nhuong-quyen-`) | Nội dung | Số màn |
| --- | --- | --- |
| `thanh-cong` | Danh sách; form trống; đã nhập đủ năm mục (doanh nghiệp, logo, tệp giấy đăng ký, hai người đại diện, văn phòng giao dịch); kiểm tra lại; mã xác thực; trang nhượng quyền mới | 6 |
| `ca-nhan` | Chọn Cá nhân (số định danh 12 số, không người đại diện); đã nhập; đã thêm | 3 |
| `ho-kinh-doanh` | Người đại diện là chủ hộ, căn cứ điền sẵn; đã thêm | 2 |
| `nhap-lieu` | Bỏ trống; tên miền công cộng, mã số 13 số, số điện thoại, Email sai; đổi tỉnh xóa xã; hỏi khi đổi hình thức pháp lý | 4 |
| `may-chu-tu-choi` | Tên miền Email công ty đã dùng; phường, xã không thuộc tỉnh | 2 |
| `ma-xac-thuc` | Mã sai; hủy xác thực giữ dữ liệu | 2 |
| `roi-trang` | Hỏi trước khi rời trang; ở lại | 2 |

| id (tiền tố `superplatform-buu-cuc-`) | Nội dung | Số màn |
| --- | --- | --- |
| `quan-tri-thanh-cong` | Thẻ Bưu cục; form trống; chọn loại hình; đã nhập; kiểm tra lại; mã xác thực; trang bưu cục mới | 7 |
| `quan-ly-khong-co-quyen` | Quản lý nhượng quyền: không có nút; mở thẳng đường dẫn bị chặn | 2 |
| `nhap-lieu` | Bỏ trống, thiếu loại hình | 1 |
| `may-chu-tu-choi` | Nhượng quyền vừa tạm ngưng; phường, xã không thuộc tỉnh | 2 |
| `nhuong-quyen-tam-ngung` | Nút Mở bưu cục bị khóa kèm lý do; mở thẳng đường dẫn | 2 |

Luồng cũ đã bỏ (Section trên Figma cần xóa tay): `superplatform-buu-cuc-quan-ly-thanh-cong`. Các bước cũ không còn (`menu-tao`, `tim-nguoi-dai-dien`, `chon-nhuong-quyen`, `ma-so-thue-da-dung`, `nguoi-dai-dien-khong-dung-duoc`) sẽ hiện ở cuối Section với tiền tố `⚠ không còn trong luồng`.

### Quên mật khẩu nội bộ — SuperPlatform (`flows/superplatform-quen-mat-khau/`)

Theo LUỒNG QUÊN MẬT KHẨU PHÍA NỘI BỘ 2.1.1, code web ngày 21/10 (`e8a89114`, mật khẩu mới đặt ngay trên trang). Mọi bước ở trang `/forgot-password` của web nội bộ: số điện thoại/Email công ty và số căn cước (gõ tay, quét mã QR hoặc chụp mặt trước thẻ) → xác nhận thông tin tìm được (họ tên, số điện thoại và CCCD đã che) → xác thực khuôn mặt (khi một công ty có liên kết yêu cầu; đồng ý trước lần chụp đầu) → chọn kênh, OTP tới số điện thoại đã xác minh → đặt mật khẩu mới → về trang đăng nhập với thông báo "Đặt mật khẩu mới thành công", mọi phiên bị đăng xuất. Viewport desktop 1440 × 900, ảnh 2×. API, captcha (ẩn), camera (khuôn mặt và thẻ vẽ sẵn) và bộ đọc mã QR đều giả lập; không gửi OTP, không gọi VNPT, không đổi mật khẩu thật. Câu báo chép từ `InternalResetIdentification`, `InternalResetCardNumber`, `InternalResetFaceStep`, `OtpChallengeService`. Chưa gồm chế độ "Quét tự động" (cần bộ xử lý khuôn mặt của VNPT).

| id (tiền tố `superplatform-quen-mat-khau-`) | Nội dung | Số màn |
| --- | --- | --- |
| `thanh-cong` | Nhập thông tin; xác nhận thông tin; đồng ý; chụp, xem lại, gửi khuôn mặt; xác minh thành công, chọn kênh; OTP; đặt mật khẩu mới; đặt thành công ở trang đăng nhập | 12 |
| `khong-xac-minh-khuon-mat` | Không công ty nào yêu cầu khuôn mặt (4 bước): xác nhận thông tin; chọn kênh; đặt mật khẩu mới | 3 |
| `thong-tin-khong-hop-le` | Số căn cước thiếu; thông tin không khớp | 2 |
| `chua-xac-thuc-can-cuoc` | Chưa có giấy tờ định danh được duyệt | 1 |
| `nhap-sai-otp` | Sai mã còn 2 lần; sai 5 lần, mã bị khóa | 2 |
| `chup-lai` | Chưa thấy rõ khuôn mặt; chụp lại | 2 |
| `khuon-mat-khong-khop` | Còn 2 lần; không khớp còn 1 lần; không khớp lần 3, dừng | 3 |
| `khong-the-xac-minh` | Chưa sẵn sàng; tạm khóa; cần xác thực lại căn cước | 3 |
| `mat-khau-chua-dat` | Mật khẩu chưa đạt; nhập lại không khớp | 2 |
| `anh-can-cuoc` | Quét mã QR, số tự điền; chụp mặt trước thẻ, chưa đọc được, chụp lại, số tự điền; xác nhận thông tin | 6 |
| `nhap-lai-thong-tin` | Không phải thông tin của mình: nhập lại, giữ chữ đã nhập | 1 |

Luồng cũ đã bỏ (Section trên Figma cần xóa tay): `superplatform-quen-mat-khau-mat-khau-tam-het-han`. Các bước cũ không còn (`mat-khau-tam`, `dang-nhap-mat-khau-tam`, `otp-lan-hai` của luồng 01; `mat-khau-tam` của luồng 02) sẽ hiện ở cuối Section với tiền tố `⚠ không còn trong luồng`.

### Đăng nhập — SuperPlatform (`flows/superplatform-dang-nhap/`)

Mọi luồng từ trang `/` của web nội bộ tới lúc vào đơn vị làm việc, theo code web và backend ngày 27/10/2026 (LUỒNG ĐĂNG NHẬP BẰNG MẬT KHẨU, LUỒNG PASSKEY phần B, Xác nhận đăng nhập trên thiết bị mới, ADR-017). Viewport desktop 1440 × 900, ảnh 2×. API, hộp xác nhận Passkey của trình duyệt và camera đều giả lập; captcha là widget thật của Cloudflare với sitekey thử. Đồng hồ của trang đứng ở phút bắt đầu lần chạy (`START` trong `flows/_helpers/superplatform-login.ts`): cố định một ngày cũ thì widget Cloudflare báo "Thời gian thiết bị không chính xác" và không cấp token. Câu báo chép từ backend (`IdentifierResolver`, `InvalidCredentialsException`, `LoginLockedException`, `AccountInactivity`, `AccountRecovery`, `AccessContextEligibilityService`, `PasskeyLoginService`, `DeviceLoginApprovalService`, `PasswordChangeReasons`, `ForcedPasswordResetService`…) và web (`LoginCard`, `session-expired-notice.ts`). Sai mật khẩu, tài khoản khóa, vô hiệu hóa, chưa kích hoạt đều cùng một câu "Thông tin đăng nhập không hợp lệ."; từ lần sai thứ 5 là câu tạm khóa riêng kèm đếm ngược. Không gồm gợi ý Passkey ở ô nhập (trình duyệt tự vẽ) và captcha chưa xong.

Helper chung: `superplatform-login.ts` (`loginFlow`, `mock.on(...)` để đổi câu trả lời API, `afterPassword`, `nextAction`, `sessionExtra`); mỗi nhóm con có helper riêng: `superplatform-device-approval.ts`, `superplatform-login-mfa.ts`, `superplatform-login-password.ts`, `superplatform-login-units.ts`.

| Section con (dưới SUPERPLATFORM → ĐĂNG NHẬP) | File | Tiền tố id (sau `superplatform-dang-nhap-`) | Số luồng | Số màn |
| --- | --- | --- | --- | --- |
| ĐĂNG NHẬP BẰNG MẬT KHẨU | `1-mat-khau.flow.ts` | `mat-khau-` | 14 | 46 |
| ĐĂNG NHẬP BẰNG PASSKEY | `2-passkey.flow.ts` | `passkey-` | 7 | 12 |
| ĐĂNG NHẬP BẰNG MÃ QR | `3-ma-qr.flow.ts` | `ma-qr-` | 1 | 1 |
| XÁC NHẬN ĐĂNG NHẬP TRÊN THIẾT BỊ MỚI | `4-thiet-bi-moi.flow.ts` | `thiet-bi-moi-` | 11 | 30 |
| XÁC THỰC HAI LỚP KHI ĐĂNG NHẬP | `5-xac-thuc-hai-lop.flow.ts` | `mfa-` | 8 | 34 |
| ĐỔI MẬT KHẨU BẮT BUỘC KHI ĐĂNG NHẬP | `6-doi-mat-khau-bat-buoc.flow.ts` | `doi-mat-khau-` | 8 | 34 |
| CHỌN ĐƠN VỊ LÀM VIỆC KHI ĐĂNG NHẬP | `7-chon-don-vi.flow.ts` | `chon-don-vi-` | 6 | 21 |
| THÔNG BÁO KHI QUAY VỀ TRANG ĐĂNG NHẬP | `8-thong-bao-quay-lai.flow.ts` | `thong-bao-` | 4 | 10 |

| id (tiền tố `superplatform-dang-nhap-`) | Nội dung | Số màn |
| --- | --- | --- |
| `mat-khau-email` | Màn đăng nhập; để trống; Email cá nhân bị từ chối; Email công ty; MFA; chọn đơn vị; trang chủ | 8 |
| `mat-khau-so-dien-thoai` | Số điện thoại; hiện mật khẩu; MFA; chọn đơn vị; trang chủ | 6 |
| `mat-khau-ma-nhan-vien` | Mã nhân viên; MFA; chọn đơn vị; trang chủ | 5 |
| `mat-khau-khoa-tam-thoi` | Sai mật khẩu; sai lần 1; sai lần 5, tạm khóa 15 phút; nút đếm ngược "Thử lại sau 15:00"; tài khoản khác mở lại nút; mở lại trang nhập đúng; đang khóa vẫn bị từ chối | 7 |
| `mat-khau-tai-khoan-bi-khoa` | Nhập đúng; bị từ chối (báo chung) | 2 |
| `mat-khau-tai-khoan-vo-hieu-hoa` | Nhập đúng; bị từ chối (báo chung) | 2 |
| `mat-khau-tai-khoan-chua-kich-hoat` | Nhập đúng; bị từ chối (báo chung) | 2 |
| `mat-khau-khoa-khong-hoat-dong` | Nhập đúng; "Tài khoản đã bị tạm khóa" vì lâu không hoạt động | 2 |
| `mat-khau-can-khoi-phuc` | Nhập đúng; tài khoản cần khôi phục qua Quên mật khẩu | 2 |
| `mat-khau-quyen-tam-dung` | Nhập đúng; mọi đơn vị tạm dừng quyền, "Chưa vào được đơn vị nào" | 2 |
| `mat-khau-chua-den-ngay-lam-viec` | Nhập đúng; chưa đến ngày bắt đầu làm việc | 2 |
| `mat-khau-chua-duoc-cap-quyen` | Nhập đúng; chưa được cấp quyền vào SuperPlatform | 2 |
| `mat-khau-ung-dung-bao-tri` | Nhập đúng; SuperPlatform đang bảo trì | 2 |
| `mat-khau-mat-ket-noi` | Nhập đúng; "Mất kết nối" | 2 |
| `passkey-thanh-cong` | Màn đăng nhập; chờ xác nhận trên máy; chọn đơn vị (không hỏi MFA); mời tin cậy thiết bị; đã tin cậy | 5 |
| `passkey-huy` | Chờ xác nhận; đóng hộp của máy, đã hủy | 2 |
| `passkey-khong-hop-le` | Passkey đã gỡ, tài khoản khóa: báo chung | 1 |
| `passkey-het-han` | Yêu cầu đã hết hạn | 1 |
| `passkey-qua-nhieu-yeu-cau` | Quá nhiều yêu cầu trong một phút | 1 |
| `passkey-khong-ho-tro` | Trình duyệt không hỗ trợ: nút Passkey bị khóa | 1 |
| `passkey-khoa-khong-hoat-dong` | Xác nhận passkey xong mới báo tài khoản bị tạm khóa vì lâu không hoạt động | 1 |
| `ma-qr-hien-ma` | Hộp mã QR, chờ xác nhận trên điện thoại (web hiện là ảnh cố định) | 1 |
| `thiet-bi-moi-cho-phep` | Nhập trên máy mới; chờ thiết bị tin cậy (số cần chọn, đếm ngược); được cho phép, chọn đơn vị; trang chủ | 4 |
| `thiet-bi-moi-ma-xac-thuc` | Không có thiết bị tin cậy: nhập mã Authenticator; đã nhập; chọn đơn vị | 3 |
| `thiet-bi-moi-ma-du-phong` | Chờ cho phép; nhập mã dự phòng; đã nhập; chọn đơn vị | 4 |
| `thiet-bi-moi-sai-ma` | Nhập mã; báo mã không đúng | 2 |
| `thiet-bi-moi-sai-qua-so-lan` | Sai 4 lần, nhập lại; "Chưa xác minh được", lần đăng nhập bị hủy; về trang đăng nhập | 3 |
| `thiet-bi-moi-tu-choi` | Chờ cho phép; "Đăng nhập chưa được chấp nhận"; về trang đăng nhập | 3 |
| `thiet-bi-moi-chon-sai-so` | Chờ cho phép; "Số không khớp"; về trang đăng nhập | 3 |
| `thiet-bi-moi-het-han` | Chờ cho phép (còn 00:05); "Bạn cần đăng nhập lại"; về trang đăng nhập | 3 |
| `thiet-bi-moi-huy` | Hỏi "Hủy yêu cầu đăng nhập?"; đã hủy, về trang đăng nhập | 2 |
| `thiet-bi-moi-xac-minh-danh-tinh` | Chưa có Authenticator: màn "Xác minh danh tính"; bước đồng ý xác thực khuôn mặt | 2 |
| `thiet-bi-moi-qua-nhanh` | "Thao tác quá nhanh", nút "Thử lại sau 1:00" | 1 |
| `mfa-sai-ma` | Màn nhập mã; nhập sai; "Mã xác thực không đúng"; nhập lại đúng; chọn đơn vị | 5 |
| `mfa-tam-khoa` | Sai lần 5; "Tạm khóa xác thực"; nút "Thử lại sau 15:00" | 3 |
| `mfa-ma-du-phong` | Màn nhập mã; chuyển sang mã dự phòng; đã nhập; "Xác thực thành công", còn 7 mã; chọn đơn vị | 5 |
| `mfa-ma-du-phong-sai` | Đã nhập mã sai; "Mã dự phòng không đúng" | 2 |
| `mfa-passkey` | Màn nhập mã; "Đang chờ passkey…"; chọn đơn vị | 3 |
| `mfa-mat-dien-thoai` | "Mất điện thoại?"; đặt lại MFA; đã nhập mã dự phòng; hỏi "Đặt lại xác thực hai lớp?"; màn đầu thiết lập Authenticator mới | 5 |
| `mfa-quay-ve-dang-nhap` | Màn nhập mã; về trang đăng nhập | 2 |
| `mfa-thiet-lap` | Đăng nhập; bắt buộc thiết lập; chọn kênh OTP; nhập OTP; quét QR; nhập sai mã; nhập đúng; lưu 10 mã dự phòng; chọn đơn vị | 9 |
| `doi-mat-khau-mat-khau-tam` | Đăng nhập bằng mật khẩu tạm; màn Đổi mật khẩu; đã nhập; mã Authenticator; chọn đơn vị; trang chủ | 6 |
| `doi-mat-khau-ly-do-khac` | Hết hạn; quá ngắn so với mức tối thiểu; chưa đủ độ dài; đủ độ dài; bị lộ | 5 |
| `doi-mat-khau-mat-khau-moi-chua-hop-le` | Chưa đạt yêu cầu; xác nhận không khớp; trùng mật khẩu hiện tại; trùng 5 mật khẩu gần nhất; đã bị lộ | 5 |
| `doi-mat-khau-sai-mat-khau-hien-tai` | Sai lần 1; sai 5 lần, tạm dừng 15 phút | 2 |
| `doi-mat-khau-quan-tri-buoc-dat-lai` | Đăng nhập; Đặt mật khẩu mới; đã nhập; đồng ý xác minh khuôn mặt; chụp; xem lại; vào chọn đơn vị, "Đã đặt mật khẩu mới" | 7 |
| `doi-mat-khau-xac-minh-otp` | Gửi mã OTP; đã nhập OTP; đặt xong, nhập mã Authenticator | 3 |
| `doi-mat-khau-khong-dat-duoc` | Trùng mật khẩu cũ; trùng 5 mật khẩu gần nhất; nhập lại không khớp; khuôn mặt không khớp còn 2 lần; sai lần 3, không thể tiếp tục | 5 |
| `doi-mat-khau-chua-co-cach-xac-minh` | Không thể tiếp tục, liên hệ Quản trị hệ thống | 1 |
| `chon-don-vi-mot-don-vi` | Xác thực hai lớp; chỉ một đơn vị, vào thẳng trang chủ | 2 |
| `chon-don-vi-mac-dinh` | Xác thực hai lớp; vào thẳng đơn vị mặc định | 2 |
| `chon-don-vi-nhieu-don-vi` | 5 đơn vị; tìm theo tên; tìm theo mã; không có kết quả; đặt mặc định; bỏ mặc định; chọn đơn vị; trang chủ | 8 |
| `chon-don-vi-don-vi-tam-dung` | Đơn vị mặc định tạm dừng nên phải chọn; các dòng bị khóa có lý do; trang chủ | 3 |
| `chon-don-vi-khong-vao-duoc` | Nhập thông tin; đơn vị duy nhất tạm ngưng, đăng xuất và báo | 2 |
| `chon-don-vi-tu-choi-khi-vao` | Chọn đơn vị; bị từ chối khi vào; làm mới danh sách; chọn đơn vị khác | 4 |
| `thong-bao-het-phien` | Phiên hết hạn; tự đăng xuất vì không thao tác | 2 |
| `thong-bao-dang-xuat-tu-noi-khac` | Đăng nhập ở nơi khác; đăng xuất từ thiết bị khác; quyền làm việc bị tạm dừng; mạng không được phép | 4 |
| `thong-bao-tu-dang-xuat` | Đăng xuất phiên hiện tại; gỡ thiết bị này; đăng xuất khỏi mọi nơi | 3 |
| `thong-bao-huy-dang-nhap` | Sai mã quá số lần khi thiết lập xác thực hai lớp | 1 |

Luồng `mat-khau-khoa-tam-thoi` đã đổi theo hành vi khóa mới (24/10): giữ các bước cũ, thêm `sai-lan-5`, `dem-nguoc`, `tai-khoan-khac`. Luồng `mat-khau-so-dien-thoai` thêm bước `hien-mat-khau`.

### Hồ sơ của tôi — SuperPlatform (`flows/superplatform-ho-so-cua-toi/`)

Trang "Thông tin tài khoản" (`/workspace/account/profile`, mục "Hồ sơ" trong Tài khoản của tôi) của web nội bộ, theo code web và backend ngày 27/10/2026. Nhân viên Nguyễn Minh Anh, SuperTek; phiên nội bộ dựng bằng `mockPin` (`superplatform-screen-lock.ts`), đồng hồ trang đứng ở 12/10/2026 09:00. Viewport desktop 1440 × 900, ảnh 2×; trạng thái trang dài chụp cả trang. API, captcha (ẩn), OTP và ảnh đại diện (vẽ sẵn, không phải ảnh người thật) đều giả lập; không đổi dữ liệu thật. Câu báo chép từ `MyProfilePage`, `EmergencyContactService`, `IdentityContractService`, `UserService`, `IdentifierChangeService`, `StepUpGuard`, `OtpSessionService`, `CurrentPasswordVerifier`, `ProfileUpdateRequestService`. Đổi số điện thoại/email luôn qua hộp "Xác nhận thao tác" (mã xác thực) sau mật khẩu, như backend đòi với mọi tài khoản.

Helper chung: `superplatform-my-profile.ts` (`profileFlow`, `mock.on(...)`, dữ liệu hồ sơ trong `mock`); helper riêng: `superplatform-my-profile-identifiers.ts` (đổi số/email, OTP, mã xác thực), `superplatform-my-profile-extras.ts` (ảnh đại diện, yêu cầu cập nhật hồ sơ).

| Section con (dưới SUPERPLATFORM → HỒ SƠ CỦA TÔI) | File | Tiền tố id (sau `superplatform-ho-so-cua-toi-`) | Số luồng | Số màn |
| --- | --- | --- | --- | --- |
| THÔNG TIN CÁ NHÂN VÀ LIÊN HỆ KHẨN CẤP | `1-thong-tin-ca-nhan.flow.ts` | không tiền tố riêng | 5 | 13 |
| ĐỔI SỐ ĐIỆN THOẠI VÀ EMAIL | `2-doi-so-dien-thoai-email.flow.ts` | `dinh-danh-` | 16 | 68 |
| ẢNH ĐẠI DIỆN | `3-anh-dai-dien.flow.ts` | `anh-dai-dien-` | 5 | 13 |
| YÊU CẦU CẬP NHẬT HỒ SƠ VÀ CẢNH BÁO | `4-yeu-cau-cap-nhat.flow.ts` | `yeu-cau-` | 4 | 10 |

| id (tiền tố `superplatform-ho-so-cua-toi-`) | Nội dung | Số màn |
| --- | --- | --- |
| `xem` | Thông tin tài khoản; Mã nhân viên, Email công ty do công ty quản lý; quản lý xem được liên hệ khẩn cấp | 3 |
| `sua-thanh-cong` | Sửa họ tên; cập nhật thành công | 2 |
| `theo-can-cuoc` | Căn cước đã xác thực: họ tên, ngày sinh, giới tính bị khóa | 1 |
| `nhap-lieu` | Xóa họ tên; liên hệ khẩn cấp nhập thiếu | 2 |
| `lien-he-khan-cap` | Số người liên hệ không hợp lệ; nhập đủ; đã lưu; xóa hết ba ô; đã gỡ | 5 |
| `dinh-danh-doi-so-dien-thoai` | Hồ sơ; hộp đổi số; đã nhập số mới và mật khẩu; mã xác thực; OTP gửi tới số mới; thành công, các thiết bị khác đã đăng xuất; hồ sơ hiện số mới | 7 |
| `dinh-danh-doi-email` | Hộp đổi email; đã nhập; mã xác thực; OTP gửi tới email mới; thành công; hồ sơ hiện email mới | 6 |
| `dinh-danh-them-email` | Hàng Email "Chưa có"; hộp thêm email; OTP; thành công; đã có email | 5 |
| `dinh-danh-them-so-dien-thoai` | Hàng "Chưa có"; hộp thêm số; OTP; thành công; đã có số | 5 |
| `dinh-danh-xac-minh-so-dien-thoai` | Số chưa xác minh; hộp chưa xác minh; mở hộp đổi số; số đang dùng bị từ chối; thành công với số mới; đã xác minh | 6 |
| `dinh-danh-xac-minh-email` | Email chưa xác minh; hộp chưa xác minh; "Xác minh ngay" mở Thêm email điền sẵn; OTP; thành công; đã xác minh | 6 |
| `dinh-danh-loi-so-dien-thoai` | Sai đầu số; thiếu chữ số; số đang dùng; số của tài khoản khác; số không dùng được | 5 |
| `dinh-danh-loi-email` | Sai định dạng; email đang dùng; email đã được dùng; email công ty | 4 |
| `dinh-danh-sai-mat-khau` | Sai mật khẩu hiện tại; nhập lại; sai quá số lần, thử lại sau 15 phút | 3 |
| `dinh-danh-tu-choi-gui-ma` | Đổi số quá số lần trong ngày; vừa đổi số nên chưa đổi được email | 2 |
| `dinh-danh-khong-co-mat-khau` | Form không hỏi mật khẩu; mã xác thực; thành công | 3 |
| `dinh-danh-xac-nhan-that-bai` | Sai mã xác thực; đóng hộp xác nhận, đã hủy | 2 |
| `dinh-danh-sai-ma-otp` | Sai mã còn 4 lần; sai quá số lần; đóng hộp, giữ số cũ | 3 |
| `dinh-danh-ma-het-han` | Mã hết hạn, hiện Gửi lại; đã gửi mã mới; mã mới cũng hết hạn; giữ số cũ | 4 |
| `dinh-danh-gui-lai-doi-kenh` | Đếm ngược 03:00; có thể gửi lại; đã gửi lại; chọn kênh Zalo; nhận mã qua Zalo | 5 |
| `dinh-danh-dong-giua-chung` | Đang chờ nhập mã; đóng hộp thì giữ số cũ | 2 |
| `anh-dai-dien-doi-anh` | Ảnh mặc định; hộp cắt ảnh; cập nhật thành công; ảnh mới trên trang và góc trên | 4 |
| `anh-dai-dien-huy-cat-anh` | Hộp cắt ảnh; đóng, giữ ảnh cũ | 2 |
| `anh-dai-dien-tep-khong-phai-anh` | Chọn tệp PDF: hộp cắt ảnh trống, Xác nhận bị khóa | 1 |
| `anh-dai-dien-kho-anh-loi` | Kho ảnh lỗi: hai hộp lỗi nối nhau; giữ ảnh cũ | 3 |
| `anh-dai-dien-xung-dot` | Hồ sơ đã đổi ở thiết bị khác: hai hộp lỗi nối nhau; giữ ảnh cũ | 3 |
| `yeu-cau-cap-nhat-theo-yeu-cau` | Thanh nhắc và dấu "Cần cập nhật"; lưu để xác nhận; lưu liên hệ khẩn cấp; đổi ảnh, thanh nhắc tự hết | 4 |
| `yeu-cau-roi-trang-khi-dang-sua` | Hộp "Bạn chưa lưu thay đổi"; ở lại; rời trang | 3 |
| `yeu-cau-cap-nhat-o-noi-khac` | Khối cảnh báo vàng; tải thông tin mới | 2 |
| `yeu-cau-luu-bi-tu-choi` | Lưu khi hồ sơ đã đổi ở thiết bị khác: Thất bại | 1 |

Chưa gồm: hết hạn yêu cầu đổi số/email sau 15 phút, chưa cài Authenticator khi đổi số/email, mật khẩu vừa đặt ở tab khác. Căn cước và nơi ở nằm ở nhóm Xác thực định danh (CCCD).

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

Thêm một Section riêng không thuộc kênh nào, `quen-mat-khau-loi-nhap-lieu` (8 màn): số điện thoại sai định dạng; mật khẩu chưa đạt, không khớp; vượt giới hạn OTP trong ngày; sau OTP mật khẩu mới trùng mật khẩu hiện tại, nhập mật khẩu khác rồi đổi; thành công. Theo luồng 2.1.1 phần B, số không có tài khoản không còn bị báo (mọi số hợp lệ đi tiếp, màn OTP luôn ghi "Nếu số này có tài khoản, hướng dẫn sẽ được gửi tới số đó."), nên bước `sdt-khong-ton-tai` cũ sẽ hiện ở cuối Section với tiền tố `⚠ không còn trong luồng`. Lỗi nhập liệu và OTP sai hiện trong hộp "Không thể hoàn tất thao tác" có nút "Đã hiểu".

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

### Khóa màn hình bằng PIN — SuperShip Web (`flows/supership-pin/`)

Bộ chụp gọn các trường hợp chính tại `/settings/security?tab=screen-lock`, tài khoản chủ shop Khả Ái. Các thay đổi cài đặt cần OTP mới; API và OTP đều giả lập, không đổi PIN hoặc gửi mã thật. Không tách từng lỗi hạ tầng hoặc từng trạng thái trung gian thành luồng riêng.

| id | Nội dung | Số màn |
| --- | --- | --- |
| `supership-pin-thiet-lap` | Chưa bật, nhập PIN/thời gian, chọn kênh OTP, xác nhận OTP, bật thành công | 5 |
| `supership-pin-nhap-pin-khong-hop-le` | Chưa đủ 6 chữ số, PIN dễ đoán, PIN nhập lại không khớp | 3 |
| `supership-pin-doi-pin` | PIN mới, xác nhận OTP, lưu thành công | 3 |
| `supership-pin-doi-thoi-gian` | Chọn thời gian mới, xác nhận OTP và lưu thành công | 2 |
| `supership-pin-tat-pin` | Xác nhận tắt, OTP, tắt thành công | 3 |
| `supership-pin-khoa-mo` | Màn đang làm việc, khóa ngay, nhập PIN, mở thành công | 4 |
| `supership-pin-sai-pin` | Sai PIN, cảnh báo còn một lần, sai lần 5 phải đăng nhập lại | 3 |
| `supership-pin-quen-pin` | Xác nhận đăng nhập lại để đặt PIN mới, màn đăng nhập | 2 |
| `supership-pin-tu-khoa` | Không thao tác đến hạn tự khóa, mở lại bằng PIN | 2 |

Luồng tự khóa dùng 10 giây để tái hiện nhanh; thiết lập thông thường mặc định 15 phút. Bộ đầy đủ 29 luồng SuperPlatform được giữ với id/stepId cũ để không làm thay đổi các Section đã có.

```powershell
.\capture --flow "supership-pin*" --no-figma
# Mở đúng page và plugin Flow Capture trong Figma desktop trước khi gửi:
.\capture --flow "supership-pin*"
```

### Khóa màn hình bằng PIN — SuperPlatform (`flows/superplatform-pin/`)

Chỉ chụp SuperPlatform tại `/workspace/account/security?tab=screen-lock`, viewport desktop 1440 × 900, ảnh 2×. Phiên nhân viên và toàn bộ API được giả lập trong trình duyệt, không thay đổi PIN thật hoặc gửi OTP. Mỗi kịch bản là một Section con, giữ nguyên id/stepId khi chụp lại.

| id (tiền tố `superplatform-pin-`) | Nội dung | Số màn |
| --- | --- | --- |
| `thiet-lap` | Chưa bật, form, PIN có số 0 đầu, hiện/ẩn PIN, MFA đúng/sai, mã dự phòng, bật thành công | 8 |
| `kiem-tra-nhap-lieu` | PIN thiếu, lặp, liên tiếp, không khớp; thời gian dưới/trên giới hạn; hủy | 7 |
| `doi-pin` | Đổi PIN, xác thực MFA mới, lưu thành công | 4 |
| `doi-thoi-gian` | Đơn vị phút/giây, xác thực MFA, lưu | 3 |
| `tat-pin` | Xác nhận/hủy, MFA, tắt thành công | 4 |
| `chua-mo-tinh-nang` | Hệ thống chưa cho thiết lập PIN | 1 |
| `chua-co-mfa` | Chưa thiết lập MFA, hủy xác thực và giữ form | 2 |
| `loi-cai-dat-1` … `loi-cai-dat-4` | Nhận diện thiết bị, PIN yếu, timeout không hợp lệ, dịch vụ chưa khả dụng | 1 mỗi luồng |
| `khoa-mo-thu-cong` | Khóa ngay, PIN thiếu/đủ, mở thành công | 5 |
| `sai-pin-nam-lan` | Lần sai 1–4 với số lượt còn lại; lần 5 thu hồi phiên | 5 |
| `loi-mo-khoa-1` … `loi-mo-khoa-3` | Giới hạn thử PIN, phiên bản trạng thái thay đổi, dịch vụ xác minh lỗi | 1 mỗi luồng |
| `mat-mang-mo-khoa` | Retry khi mất kết nối dùng cùng attempt_id; mở thành công | 2 |
| `mat-mang-khi-khoa` | Che nội dung trong LOCK_PENDING; kết nối lại xác nhận khóa | 2 |
| `quen-pin` | Cảnh báo bản nháp, quay lại, kết thúc phiên để đăng nhập lại | 3 |
| `dang-xuat` | Xác nhận, lỗi mạng, thử lại và đăng xuất thành công | 3 |
| `tai-lai-khi-khoa` | Reload, không có bản chụp nền, hết hạn/thu hồi phiên | 3 |
| `tu-khoa` | 10 giây không thao tác, khóa IDLE, mở lại | 3 |
| `menu-tai-khoan` | Menu tài khoản và khóa từ menu | 2 |
| `menu-chua-pin` | Chưa có PIN — chuyển đến thiết lập | 2 |
| `dong-bo-tab-giu-nhap` | Hai tab thực: đồng bộ khóa/mở, giữ giá trị form chưa lưu | 3 |
| `mo-tab-dang-khoa` | Trang mới không có bản chụp nền vẫn yêu cầu PIN | 2 |
| `kiem-tra-phien-loi-mang` | Che nội dung khi kiểm tra phiên lỗi; phục hồi kết nối | 2 |
| `dang-xac-minh` | Chờ máy chủ khóa, đang xác minh PIN, hoàn tất | 3 |
| `mfa-sau-mo-khoa` | PIN đúng nhưng phiên vẫn yêu cầu hoàn tất MFA | 2 |

Phạm vi là trạng thái giao diện của tính năng PIN; quy trình liên kết ứng dụng MFA và đăng nhập đầy đủ có thể dùng luồng riêng. Các quy tắc thu hồi phiên, giới hạn PIN, idempotency và phiên đồng bộ trong ảnh sử dụng API fixture, không thay thế nghiệm thu backend thật.

```powershell
.\capture --flow "superplatform-pin*" --no-figma
# Sau khi xem ảnh, mở đúng page và Flow Capture trong Figma desktop:
.\capture --flow "superplatform-pin*"
```

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
| `web.cmd` | Lệnh `.\web`: trang xem ảnh và gửi sang Figma |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Hướng dẫn, quy trình và quyền lệnh cho công cụ AI |
| `capture.config.ts` | Cấu hình chung: app, viewport, phần tử ẩn, bố cục trên Figma |
| `capture/` | CLI: đọc cấu hình, tìm luồng, chạy Playwright, cắt ảnh, gửi sang Figma, chế độ layers |
| `flows/` | Các luồng (`*.flow.ts`), chia thư mục theo nhóm |
| `flows/_helpers/` | Code dùng chung của các luồng: backend giả lập, captcha, phiên đăng nhập |
| `plugin/` | Plugin Figma: `src/` là mã nguồn, `dist/` là bản build, `manifest.json` để import |
| `server/` | Server trung chuyển WebSocket giữa CLI và plugin |
| `web/` | Trang web cục bộ: server HTTP, đọc `captures/`, gửi ảnh có sẵn sang Figma |
| `shared/types.ts` | Định dạng tin nhắn giữa CLI, server và plugin |
| `scripts/` | Build plugin và các script tự kiểm tra |
| `captures/` | Ảnh đầu ra (không vào git) |

## 14. Giới hạn hiện tại

- Chưa hỗ trợ đăng nhập theo `actor` (tự đăng nhập, lưu và dùng lại phiên). Luồng khai báo `actor` bị từ chối với thông báo rõ ràng. Các trang sau đăng nhập hiện dùng `mockSignedInShop`.
- Plugin chỉ chạy trên Figma desktop.
- Chế độ layers và lệnh `.\capture` chỉ chạy trên Windows.
- App `superplatform` có nhóm khóa màn hình bằng PIN; chưa có luồng cho viewport `mobile`.
