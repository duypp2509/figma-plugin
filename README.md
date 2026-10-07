# figma-flow-capture

Chạy từng luồng người dùng bằng Playwright, chụp màn hình ở mỗi bước và dựng thành Section trong Figma: mỗi luồng một Section, các bước là frame xếp từ trái sang phải.

Công cụ độc lập với các repo trong workspace: nó chỉ đọc code của app để lấy nhãn, không sửa gì trong đó.

```
CLI (Playwright)  ──ws──►  server local 127.0.0.1:8765  ──ws──►  plugin Figma (Figma desktop)
```

## Cài đặt

Cần Node >= 22 và Figma desktop.

```powershell
npm install
npx playwright install chromium
npm run build:plugin
```

Import plugin một lần: Figma desktop → Plugins → Development → Import plugin from manifest… → chọn `plugin/manifest.json`.

Plugin chỉ nhận dữ liệu khi đang mở trong Figma desktop. Sau mỗi lần sửa code trong `plugin/src`, chạy lại `npm run build:plugin` rồi mở lại plugin.

## Chạy

Trong PowerShell hãy dùng `.\capture`. Đừng dùng `npm run capture -- <cờ>`: PowerShell nuốt mất dấu `--` nên cờ không tới được CLI và công cụ sẽ chạy toàn bộ luồng.

```powershell
.\capture --list                                   # các luồng tìm thấy
.\capture --flow dang-ky-shop-mock --no-figma      # chỉ lưu ảnh vào captures/
.\capture --flow dang-ky-shop-mock                 # chụp và gửi sang Figma
.\capture                                          # mọi luồng
```

| Cờ | Tác dụng |
| --- | --- |
| `--flow <id>` | Chỉ chạy luồng này; lặp lại được |
| `--viewport <tên>`, `--actor <tên>` | Chỉ chạy biến thể này |
| `--section-name "<tên>"` | Ghi đè tên Section |
| `--headed` | Mở trình duyệt để xem |
| `--no-figma` | Không gửi sang Figma |
| `--pause-on-step <stepId>` | Dừng trước khi chụp bước này để thao tác tay, Enter để tiếp tục |

Khi gửi sang Figma: mở file Figma, chạy plugin **Flow Capture**, giữ cửa sổ plugin mở rồi mới chạy lệnh. CLI tự khởi động server nếu chưa có (hoặc chạy sẵn bằng `npm run server`) và chờ plugin tối đa 2 phút.

Ảnh lưu ở `captures/<flowId>/<NN>-<stepId>.png`. Luồng lỗi giữa chừng để lại `_loi.png` và `_loi.log` trong cùng thư mục; các luồng khác vẫn chạy, và lệnh thoát với mã khác 0.

## Thêm một luồng mới

1. Tạo `flows/<tên>.flow.ts`. Không cần đăng ký ở đâu: CLI tự quét mọi file `*.flow.ts` trong `flows/` (bỏ qua thư mục bắt đầu bằng `_`).

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
4. Chạy thử: `.\capture --flow quen-mat-khau --no-figma --headed`.

### `defineFlow`

| Trường | Ý nghĩa |
| --- | --- |
| `id` | Duy nhất, chữ thường/số/gạch ngang. Là khóa của Section trên Figma: đổi id là tạo Section mới |
| `name` | Tên Section |
| `app` | Tên app trong `capture.config.ts` (`supership` → :3001, `superplatform` → :3000) |
| `viewports?` | Ví dụ `["desktop", "mobile"]`; mỗi viewport là một Section riêng. Mặc định `desktop` |
| `actor?` | Chưa dùng được, xem "Chưa làm" |
| `sectionName?` | Tên Section khác với `name` |
| `run(ctx)` | `ctx` gồm `page`, `context`, `shot`, `data`, `app`, `viewport`, `log` |

### `shot(stepId, title, options?)`

Thứ tự bước là thứ tự gọi. `stepId` là khóa của frame trên Figma: giữ nguyên để lần chạy sau thay ảnh đúng frame.

| Option | Ý nghĩa |
| --- | --- |
| `mode` | `"viewport"` (mặc định, giữ nguyên modal và lớp phủ), `"fullPage"`, `"element"` |
| `target` | Phần tử cần chụp khi `mode: "element"` |
| `code` | Mã giao diện, ví dụ `"TK-02"`; hiện trong tên frame |
| `hide` | Selector cần ẩn thêm cho riêng bước này |
| `mask` | Phần tử cần che (dữ liệu nhạy cảm) |
| `delayMs` | Chờ thêm trước khi chụp |

Các lớp phủ dev của app (nút Figma, nhật ký debug, "Tài khoản test", "Tự điền dữ liệu mẫu", chỉ báo Next.js) được ẩn tự động trong lúc chụp; danh sách ở `hide` trong `capture.config.ts`.

### Helper có sẵn

| Helper | File | Dùng để |
| --- | --- | --- |
| `data.phone()`, `data.email()`, `data.digits(n)`, `data.pick(list)` | `ctx.data` | Dữ liệu ngẫu nhiên cho luồng tạo bản ghi |
| `waitEnabled(locator)` | `flows/_helpers/wait.ts` | Chờ nút hết bị khóa |
| `freezeTime(page)` | `flows/_helpers/wait.ts` | Đứng đồng hồ để bộ đếm ngược hiện cùng một giá trị ở mọi lần chạy |
| `fillRegisterForm`, `openOtpChannelDialog`, `requestOtp`, `submitOtp`, `DEV_OTP` | `flows/_helpers/supership-register.ts` | Các bước của màn đăng ký Shop |
| `mockRegisterApi` | `flows/_helpers/supership-register.ts` | Trả lời API đăng ký ngay trong trình duyệt |
| `mockTurnstile(page)` | `flows/_helpers/turnstile.ts` | Cho captcha tự qua ở các luồng dùng backend giả lập, xem "Captcha" bên dưới |

## Hai luồng mẫu

- `dang-ky-shop-mock`: API đăng ký và captcha được giả lập, không tạo tài khoản, không tốn OTP. Dùng cho việc chụp lại thường ngày.
- `dang-ky-shop`: chạy với backend dev thật. **Mỗi lần chạy tạo một tài khoản và Shop mới** và dùng một trong 50 OTP/ngày. App local đang dùng sitekey Turnstile thật, nên phải chạy `--headed` và tự bấm captcha trong vòng 3 phút.

## Luồng sau đăng nhập và luồng vai trò của shop

Backend local kiểm tra captcha thật nên không tự động đăng nhập được. Các luồng sau đăng nhập dùng `mockSignedInShop(page, shop, permissions, log)` trong `flows/_helpers/supership-session.ts`: trao cho tab một phiên có sẵn và trả lời mọi lời gọi `/api/backend/**` ngay trong trình duyệt, đúng cách các script smoke test của repo backend đang làm. `backend.on(method, /đường-dẫn/, handler)` thêm hoặc thay câu trả lời cho một API; lời gọi nào chưa được giả lập sẽ nhận 404 và được in ra dạng `chưa giả lập: GET /v1/…` để bạn bổ sung.

Luồng vai trò của shop nằm trong `flows/vai-tro-shop/`, chạy bằng `.\capture --flow "vai-tro-shop*"`, chung Section cha **QUẢN LÝ VAI TRÒ CỦA SHOP**:

| Section con | id | Các màn |
| --- | --- | --- |
| 1. XEM DANH SÁCH VÀ CHI TIẾT VAI TRÒ | `vai-tro-shop-xem-vai-tro` | Danh sách, chi tiết Chủ cửa hàng, tìm quyền, tìm không có kết quả, chi tiết Nhân viên vận hành, chi tiết Kế toán |
| 2. CÁC TRẠNG THÁI KHÁC | `vai-tro-shop-trang-thai-khac` | Chưa có vai trò, vai trò chưa có quyền, không có quyền xem, shop một người dùng |

Tên vai trò, mô tả và bộ quyền lấy từ dữ liệu của backend (`V1046__shop_accountant_operator_roles.sql`, `R__authorization_dev_seed.sql`); xem `flows/_helpers/supership-shop-roles.ts`.

Luồng thành viên của shop nằm trong `flows/thanh-vien-shop/`, chạy bằng `.\capture --flow "thanh-vien-shop*"` (28 luồng, 108 màn). Tất cả nằm trong một Section cấp 1 **THÀNH VIÊN CỬA HÀNG**, ứng với mục "Thành viên" trên sidebar. Bên trong, hai luồng chỉ xem thì đặt frame trực tiếp; các mảng còn lại là một Section cấp 2 chứa mỗi luồng một Section cấp 3. Chạy riêng một mảng bằng tiền tố id, ví dụ `--flow "thanh-vien-shop-vai-tro*"`.

| Section trong THÀNH VIÊN CỬA HÀNG | Tiền tố id | Các luồng (mỗi luồng một Section con) |
| --- | --- | --- |
| XEM DANH SÁCH VÀ TÌM KIẾM/LỌC THÀNH VIÊN | `thanh-vien-shop-danh-sach` | Không có Section con: 7 frame |
| XEM THÔNG TIN THÀNH VIÊN | `thanh-vien-shop-thong-tin` | Không có Section con: 5 frame |
| QUẢN LÍ TRẠNG THÁI TƯ CÁCH THÀNH VIÊN | `thanh-vien-shop-trang-thai` | Tạm khóa; kích hoạt lại; ngừng hoạt động |
| CHI TIẾT THÀNH VIÊN - TAB VAI TRÒ | `thanh-vien-shop-vai-tro` | Xem vai trò; xem chi tiết quyền trong vai trò; xem lịch sử; thêm vai trò; thêm thất bại do đã có vai trò; thu hồi vai trò |
| CHI TIẾT THÀNH VIÊN - TAB QUYỀN BỔ SUNG | `thanh-vien-shop-quyen-bo-sung` | Xem danh sách (kèm lịch sử); xem chi tiết 1 quyền; cấp quyền; cấp thất bại do người cấp không có quyền đó; thu hồi quyền |
| CHI TIẾT THÀNH VIÊN - TAB QUYỀN BỊ THU HỒI | `thanh-vien-shop-quyen-bi-thu-hoi` | Xem danh sách (kèm lịch sử); thu hồi quyền; khôi phục quyền |
| MỜI THÀNH VIÊN | `thanh-vien-shop-moi`, `thanh-vien-shop-loi-moi` | Mời thành viên mới; 3 trường hợp mời thất bại; xem danh sách lời mời đã gửi; thu hồi lời mời; thu hồi thất bại; gửi lại liên kết mời; gửi lại thất bại |

Backend giả lập (`mockShopMembers` trong `flows/_helpers/supership-shop-members.ts`) có trạng thái: cấp, thu hồi, khôi phục, tạm khóa, thu hồi lời mời… thật sự làm đổi dữ liệu mà luồng quay lại xem. Câu báo lỗi của các nhánh thất bại chép từ mã nguồn backend. Thời gian đứng ở 09:00 06/10/2026 nên ngày giờ trong ảnh không đổi giữa các lần chạy. Một luồng mới viết bằng `memberFlow({ id, group, name, run })` trong cùng file helper.

Luồng xác thực email ở trang "Thông tin tài khoản" (`/settings/profile`) cho tài khoản có email chưa xác thực nằm trong `flows/thong-tin-tai-khoan/`, chạy bằng `.capture --flow "xac-thuc-email*"` (3 luồng, 14 màn), chung Section **THÔNG TIN TÀI KHOẢN - XÁC THỰC EMAIL**: xác thực thành công, thất bại do nhập sai mã, gửi lại mã. Backend giả lập là `mockUnverifiedEmail` trong `flows/_helpers/supership-profile.ts`.

Luồng lời mời của chính người đang đăng nhập (mục "Lời mời" trên sidebar, `/settings/invitations`) nằm trong `flows/loi-moi-cua-toi/`, chạy bằng `.capture --flow "loi-moi-cua-toi*"` (5 luồng, 20 màn), chung Section **LỜI MỜI THAM GIA CỦA TÔI**: xem lời mời đang chờ, xem lịch sử, chấp nhận, từ chối, chấp nhận thất bại do lời mời không còn hiệu lực. Backend giả lập là `mockMyInvitations` trong `flows/_helpers/supership-my-invitations.ts`; chấp nhận hay từ chối sẽ chuyển lời mời sang lịch sử.

Với `mode: "fullPage"`, nếu nội dung cuộn bên trong một khung (như phần nội dung của giao diện sau đăng nhập), công cụ tạm kéo dài cửa sổ trình duyệt cho vừa nội dung rồi mới chụp, nên ảnh có đủ cả trang.

## Chế độ layers: frame chỉnh sửa được thay cho ảnh phẳng

```powershell
.\capture --flow quen-mat-khau-sms-thanh-cong --render layers
```

Mỗi bước được chụp bằng chính script html-to-design của Figma (cái đứng sau nút "Figma" trên app), cho ra dữ liệu mà ứng dụng Figma biến thành layer khi được dán. Plugin API không làm được việc chuyển đổi đó, nên cần một lần Ctrl+V cho mỗi màn:

1. Công cụ chạy hết các luồng đã chọn và lưu `NN-<stepId>.layers.html` cạnh file PNG. Chưa có gì gửi sang Figma ở bước này.
2. Sau đó, với từng màn, công cụ đưa dữ liệu lên clipboard của Windows và plugin hiện khung vàng "Nhấn Ctrl+V trên canvas".
3. Bạn bấm vào vùng trống trên canvas một lần, rồi Ctrl+V mỗi khi khung vàng đổi sang màn mới. Plugin nhận frame vừa dán, đặt tên, và xếp vào đúng Section, đúng vị trí. "Bỏ qua màn này" để bỏ một màn.

Thêm `--auto-paste` để công cụ nhấn Ctrl+V thay bạn:

```powershell
.\capture --flow "loi-moi-shop*" --render layers --auto-paste
```

Sau khi chụp xong, công cụ báo và chờ 8 giây: lúc đó bấm vào vùng trống trên canvas của Figma rồi để yên máy. Với mỗi màn, nó đưa cửa sổ Figma lên trước, nhấn Ctrl+V, và chờ plugin báo đã nhận rồi mới sang màn sau. Phím chỉ được gửi khi cửa sổ Figma thật sự đang ở trên cùng, và không bao giờ gửi lần hai cho cùng một màn. Nếu không đưa được Figma lên trước, hoặc sau 20 giây Figma chưa nhận, công cụ nhắc bạn tự nhấn Ctrl+V và tiếp tục chờ. Trong lúc chạy đừng dùng máy vào việc khác: cửa sổ Figma liên tục bị kéo lên trước, và nếu con trỏ nằm trong một ô nhập của Figma thì cú dán sẽ vào ô đó thay vì canvas. Nếu ứng dụng không tên là "Figma" (ví dụ bản Beta), đặt biến `FFC_FIGMA_PROCESS`.

Cần biết:

- Clipboard của máy bị thay nội dung trong lúc dán; đừng copy thứ khác cho tới khi xong.
- Trong lúc plugin đang chờ, đừng tạo hay dán thứ gì khác lên page: plugin coi node mới xuất hiện là màn đang chờ.
- Ô captcha trống trong bản layer (widget Cloudflare nằm trong iframe khác nguồn, script không đọc được). Bản PNG vẫn có.
- Figma cần có font Open Sans, nếu không chữ bị thay font.
- Chạy lại một luồng ở chế độ nào thì frame của từng bước được thay bằng kết quả của chế độ đó.
- Chỉ chạy trên Windows (dùng `Set-Clipboard -AsHtml` của Windows PowerShell).

## Captcha

App local dùng sitekey Cloudflare Turnstile thật, mà trình duyệt tự động không qua được captcha thật. `mockTurnstile(page)` có hai chế độ:

- `"visible"` (mặc định): vẫn tải widget thật của Cloudflare nhưng ép nó dùng sitekey thử nghiệm chính thức (luôn pass), nên ô captcha có trong ảnh ở trạng thái "Thành công!". Dải chữ đỏ "Chỉ để kiểm tra…" mà Cloudflare chèn ở chế độ thử nghiệm được ẩn đi, vì người dùng thật không bao giờ thấy nó. Cần có mạng tới `challenges.cloudflare.com`, và đồng hồ của trang phải đúng giờ thật (đóng băng ở giờ hiện tại thì được, đặt về ngày khác thì widget không xác minh).
- `"hidden"`: thay widget bằng bản giả chỉ trả token, không vẽ gì. Chạy được khi không có mạng; ô captcha để trống trong ảnh.

Cả hai chỉ dùng cho luồng có backend giả lập: backend thật sẽ từ chối token này. Trước mỗi lần chụp, công cụ tự chờ mọi widget trên trang xác minh xong.

## Luồng quên mật khẩu

Các luồng nằm trong `flows/quen-mat-khau/`. Tất cả dùng backend giả lập (`mockPasswordReset`): không đổi mật khẩu, không gửi OTP; câu chữ lỗi được chép từ mã nguồn backend.

Chạy tất cả: `.\capture --flow "quen-mat-khau*"`.

Hai Section cha, mỗi kênh một cái: **QUÊN MẬT KHẨU - ĐẶT LẠI MẬT KHẨU DÙNG OTP QUA SMS** và **… QUA ZALO**. Trong mỗi Section cha có 5 Section con xếp dọc (`<kênh>` là `sms` hoặc `zalo`):

| Section con | id | Số bước |
| --- | --- | --- |
| 1. ĐẶT LẠI MẬT KHẨU THÀNH CÔNG | `quen-mat-khau-<kênh>-thanh-cong` | 8 |
| 2. GỬI LẠI OTP | `quen-mat-khau-<kênh>-gui-lai-otp` | 5 |
| 3. ĐỔI KÊNH NHẬN OTP | `quen-mat-khau-<kênh>-doi-kenh-nhan-otp` | 5 |
| 4. NHẬP SAI QUÁ SỐ LẦN QUY ĐỊNH | `quen-mat-khau-<kênh>-nhap-sai-qua-so-lan` | 4 |
| 5. HẾT PHIÊN OTP | `quen-mat-khau-<kênh>-het-phien-otp` | 5 |

Ngoài ra có một Section riêng, không thuộc kênh nào: `quen-mat-khau-loi-nhap-lieu` (số điện thoại sai định dạng, không tồn tại; mật khẩu chưa đạt, không khớp, trùng mật khẩu hiện tại; vượt giới hạn OTP trong ngày).

## Luồng chấp nhận lời mời tham gia shop (người chưa có tài khoản)

Các luồng nằm trong `flows/loi-moi-tham-gia-shop/`, dùng backend giả lập (`mockMemberInvitation`): không tạo tài khoản hay cửa hàng, không gửi OTP. Chạy tất cả: `.\capture --flow "loi-moi-shop*"`.

Hai Section cha: **CHẤP NHẬN LỜI MỜI THAM GIA SHOP (CHƯA CÓ TÀI KHOẢN) - XÁC THỰC OTP QUA SMS** và **… QUA ZALO**, mỗi cái có 5 Section con (`<kênh>` là `sms` hoặc `zalo`):

| Section con | id | Số bước |
| --- | --- | --- |
| 1. THAM GIA THÀNH CÔNG | `loi-moi-shop-<kênh>-thanh-cong` | 6 |
| 2. GỬI LẠI OTP | `loi-moi-shop-<kênh>-gui-lai-otp` | 6 |
| 3. ĐỔI KÊNH NHẬN OTP | `loi-moi-shop-<kênh>-doi-kenh-nhan-otp` | 6 |
| 4. NHẬP SAI QUÁ SỐ LẦN QUY ĐỊNH | `loi-moi-shop-<kênh>-nhap-sai-qua-so-lan` | 5 |
| 5. HẾT PHIÊN OTP | `loi-moi-shop-<kênh>-het-phien-otp` | 6 |

Một Section riêng cho các trường hợp không phụ thuộc kênh, `loi-moi-shop-truong-hop-khac` (9 bước): lời mời hết hiệu lực, thông tin chưa hợp lệ, email đã được dùng, chưa gửi được mã, vượt giới hạn OTP, lời mời đóng khi đang tạo tài khoản, từ chối lời mời.

## Trên Figma

- Tên frame có dạng `<Tên sản phẩm> - <TÊN BƯỚC VIẾT HOA>`, ví dụ `SuperShip - NHẬP SỐ ĐIỆN THOẠI`. Tên sản phẩm lấy từ `label` của app trong `capture.config.ts`; tên bước là `title` truyền cho `shot()`.
- Luồng khai báo `group: "<tên>"` được đặt trong một Section cha mang tên đó, cùng các luồng khác chung `group`, xếp dọc theo thứ tự chạy lần đầu. `group: ["<cấp 1>", "<cấp 2>"]` lồng Section nhiều cấp, từ ngoài vào trong; một Section cha chứa được cả luồng lẫn Section con.
- Tô màu Section theo cấp (bật/tắt trong cửa sổ plugin): Section ngoài cùng dùng màu `Section 2`, Section bên trong dùng `Section 3`, rồi `Section 4`… Cấp bắt đầu đổi bằng `layout.colorFrom` trong `capture.config.ts`. Plugin tìm biến màu hoặc paint style có tên (hoặc tên collection) chứa `Section <số>`, trong file trước rồi tới các thư viện đang bật. Không tìm thấy thì giữ màu mặc định và liệt kê các tên màu đọc được ở dòng "Lỗi / cảnh báo".
- Khoảng cách trên canvas chỉnh ở `layout` trong `capture.config.ts`: `gap` (giữa hai frame), `padding` (lề Section), `headroom` (khoảng trống phía trên để tên Section không đè lên tên frame), `rowGap` (giữa các Section xếp dọc), `sectionGap` (giữa Section mới và nội dung đã có trên page). Mũi tên giữa các frame mặc định tắt (`arrows: false`).
- Một file luồng có thể `export default` một mảng luồng (ví dụ cùng một hành trình cho từng kênh OTP).
- `--flow "tiền-tố*"` chọn mọi luồng có id bắt đầu bằng tiền tố.
- Section được nhận diện bằng `id` của luồng (kèm viewport), không theo tên, nên đổi tên Section trong Figma không làm lệch.
- "Ghi đè luồng cũ": chạy lại thì thay ảnh trong frame cùng `stepId`; bước mới chèn đúng vị trí; bước không còn trong luồng được giữ lại ở cuối với tiền tố `⚠ không còn trong luồng`.
- "Tạo section mới kèm thời gian": luôn tạo Section mới bên dưới nội dung sẵn có.
- Figma chỉ nhận ảnh tối đa 4096 px mỗi chiều, nên ảnh dài được cắt thành nhiều lát xếp liền nhau trong frame.

## Kiểm tra không cần app

```powershell
npm run test:relay    # server + cắt/ghép ảnh, không cần Figma
npm run test:send     # gửi 3 ảnh cố định vào Figma (cần mở plugin)
npx tsx scripts/fake-plugin.ts   # plugin giả, để thử CLI khi không có Figma
```

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
| --- | --- |
| Lệnh chạy hết mọi luồng dù đã truyền `--flow` | Đang dùng `npm run capture -- …` trong PowerShell. Dùng `.\capture …` |
| `Plugin Figma không kết nối sau 120 giây` | Plugin chưa mở, hoặc đang mở Figma trên trình duyệt. Mở plugin trong Figma desktop; bấm "Kết nối lại" |
| Plugin báo "Chưa kết nối" | Chưa có server: chạy `.\capture …` hoặc `npm run server` |
| `Phần tử vẫn bị khóa … 'Nhận mã OTP'` | Captcha chưa qua. Luồng mock: gọi `mockTurnstile(page)` trước khi mở trang, và kiểm tra mạng tới Cloudflare (hoặc dùng chế độ `"hidden"`). Luồng thật: chạy `--headed` và bấm captcha |
| Luồng đứng ở một bước rồi timeout | Nhãn hoặc cấu trúc màn hình đã đổi. Xem `_loi.png`, sửa locator trong file luồng |
| `browserType.launch: Executable doesn't exist` | Chạy `npx playwright install chromium` |

## Chưa làm

- Đăng nhập theo `actor` (tự đăng nhập, lưu và dùng lại phiên). Luồng khai báo `actor` hiện bị từ chối với thông báo rõ ràng.
- Chế độ "layers" (layer chỉnh sửa được thay cho ảnh phẳng).
