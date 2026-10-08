---
name: tao-luong
description: Viết luồng chụp mới (file *.flow.ts) hoặc sửa luồng đang lỗi trong repo figma-flow-capture. Dùng khi người dùng nói "tạo luồng cho màn…", "thêm luồng…", "chụp màn X" mà chưa có luồng nào cho màn đó, "thêm trường hợp lỗi vào luồng…", "luồng X chạy lỗi / timeout", hoặc khi app đổi giao diện làm luồng cũ hỏng. Để chạy luồng đã có thì dùng chup-luong.
---

# Viết hoặc sửa một luồng

Một luồng là một file TypeScript điều khiển trình duyệt bằng Playwright và gọi `shot()` ở mỗi màn cần chụp. Phần khó không nằm ở thao tác bấm mà ở chỗ làm cho app hiện đúng màn hình mà không cần backend thật: mọi luồng ở đây trả lời các lời gọi API ngay trong trình duyệt.

Tài liệu tham chiếu đầy đủ về `defineFlow`, `shot()` và các helper: mục 9 của [README.md](../../../README.md). Đọc nó trước khi viết luồng đầu tiên.

## 1. Làm rõ cần chụp gì

Hỏi người dùng, gộp trong một lần, những gì họ chưa nói:

- **Màn hình hay tính năng nào**, vào từ đâu (đường dẫn hoặc mục trên menu).
- **Những kịch bản nào**: đường thành công, và từng nhánh thất bại cần có ảnh (nhập sai, thiếu quyền, hết hạn, trùng dữ liệu…). Mỗi kịch bản thường là một luồng riêng.
- **Vai người dùng**: chủ shop, thành viên chỉ có quyền xem…
- **Đặt trong Section nào trên Figma**: nhóm đã có hay nhóm mới.

Trước khi hỏi, chạy `.\capture --list --json` để biết màn này đã có luồng nào chưa. Đã có thì đây là việc sửa hoặc bổ sung, không phải viết mới.

## 2. Đọc mã nguồn app (chỉ đọc)

`.\capture --doctor --json` cho biết thư mục mã nguồn app và backend. Thiếu thì hỏi người dùng đường dẫn và nhờ họ đặt `SUPERSHIP_SRC`, `BACKEND_SRC` trong `.env`. Không bao giờ sửa gì trong các thư mục đó.

Cần tìm ra:

- **Route** của màn hình và component dựng nó.
- **Nhãn chính xác**: tiêu đề, nút, placeholder, thông báo. Locator dựa vào đúng các chuỗi này, sai một dấu là timeout.
- **Các API màn hình gọi** (đường dẫn sau `/api/backend`), kèm hình dạng dữ liệu trả về mà component đọc.
- **Câu báo lỗi của từng nhánh thất bại**: chép nguyên văn từ mã nguồn backend, cùng mã lỗi (`code`) và mã HTTP. Không tự đặt câu.

## 3. Dùng lại cái đã có

Xem `flows/_helpers/` trước khi viết gì mới.

| Cần | Dùng |
| --- | --- |
| Trang sau đăng nhập | `mockSignedInShop(page, KHA_AI_SHOP, permissions, log)` trong `supership-session.ts`; trả về `backend` |
| Trả lời một API | `backend.on("GET", /^\/v1\/…$/, () => ({ data }))`; lỗi: `({ status: 409, code: "…", message: "…" })`. Handler khai báo sau thắng handler trước |
| Đổi quyền giữa chừng | `backend.setPermissions([...])`, có hiệu lực từ lần tải trang kế tiếp |
| Danh sách có phân trang | `pageOf(items)` trong `supership-session.ts` |
| Bộ quyền mẫu | `OWNER_PERMISSIONS` trong `supership-shop-roles.ts` |
| Captcha ở trang chưa đăng nhập | `mockTurnstile(page)` trong `turnstile.ts`, gọi trước `page.goto()` |
| OTP: gửi lại, hết hạn, nhập sai | `OtpSessionMock`, `DEV_OTP` trong `otp-session.ts` |
| Ngày giờ và đếm ngược cố định | `freezeTime(page, at?)` trong `wait.ts` |
| Chờ nút hết bị khóa | `waitEnabled(locator)` trong `wait.ts` |

**Thêm luồng vào nhóm đã có**: mỗi nhóm có một hàm bọc đã gắn sẵn tiền tố id, `group` và backend giả lập, ví dụ `shopInfoFlow` (`supership-shop-info.ts`), `memberFlow` (`supership-shop-members.ts`), `ownRolesFlow`, `myInvitationsFlow`, `emailVerificationFlow`. Dùng hàm đó và xem các file `*.flow.ts` cùng thư mục làm mẫu.

**Nhóm mới**: tạo `flows/_helpers/supership-<tên>.ts` theo đúng khuôn của `supership-shop-info.ts`, file ngắn và đầy đủ nhất để bắt chước:

- hằng `GROUP` (tên Section cha, viết hoa) và đường dẫn trang;
- hàm `mock<Tên>(backend)` đăng ký các `backend.on(...)`, giữ trạng thái trong biến cục bộ để thao tác lưu, xóa thật sự đổi dữ liệu mà màn hình đọc lại sau đó;
- hàm bọc `<tên>Flow({ id, name, run })` gọi `defineFlow` với tiền tố id, `group`, `app`, rồi dựng phiên và backend trước khi gọi `run`;
- các locator và bước dùng chung (`open…`, `…Button`).

## 4. Viết luồng

Đặt file ở `flows/<nhóm>/<số>-<tên>.flow.ts`. Không cần đăng ký ở đâu. Một file có thể `export default` một mảng luồng.

```ts
import { openShopInfo, saveButton, shopInfoFlow, shopName } from "../_helpers/supership-shop-info";

export default [
  shopInfoFlow({
    id: "doi-ten",
    name: "ĐỔI TÊN CỬA HÀNG",
    async run({ page, shot }) {
      await openShopInfo(page);
      await shot("thong-tin-cua-hang", "Thông tin cửa hàng");

      await shopName(page).fill("Khả Ái Store");
      await shot("da-sua-ten", "Đã sửa tên cửa hàng");

      await saveButton(page).click();
      await page.locator("dialog[open]").getByText("Cập nhật thông tin cửa hàng thành công.").waitFor();
      await shot("cap-nhat-thanh-cong", "Cập nhật thành công");
    },
  }),
];
```

Quy ước:

- `id`: duy nhất trong cả repo, không dấu, chữ thường, gạch ngang, bắt đầu bằng tiền tố của nhóm. `name`: tên Section, theo cách viết của nhóm (thường viết hoa).
- `stepId`: không dấu, chữ thường, gạch ngang, không trùng trong một luồng. `title`: tiếng Việt có dấu, mô tả màn hình; nó thành tên frame.
- Luồng đã có trên Figma: giữ nguyên `id` và `stepId` cũ, chỉ thêm bước mới. Đổi là tạo Section hoặc frame mới thay vì cập nhật.
- Trước mỗi `shot()`, chờ một dấu hiệu cụ thể của đúng màn đó (`locator.waitFor()`). Không chờ network idle, không dùng `waitForTimeout` để "cho chắc".
- Ưu tiên locator theo vai trò và nhãn (`getByRole`, `getByLabel`, `getByText`), thêm `exact: true` khi nhãn là tiền tố của nhãn khác.
- Trang dài hơn màn hình: `shot(…, { mode: "fullPage" })`. Hộp thoại, lớp phủ: để mặc định (`viewport`) cho đúng cái người dùng thấy.
- Dữ liệu trong ảnh phải trông thật: tên người, tên shop, số điện thoại tiếng Việt hợp lý, lấy từ fixture sẵn có khi được.
- Luồng có hậu quả thật ngoài trình duyệt (gọi backend thật để tạo dữ liệu): khai báo `caution: "<hậu quả>"`. Mặc định hãy viết bản giả lập.

## 5. Chạy và tự kiểm tra

```powershell
.\capture --flow <id> --no-figma
```

Lặp cho tới khi sạch:

1. Đọc `captures/_last-run.json`. Luồng lỗi: đọc `errorLog`, mở `errorScreenshot` để thấy app đang ở màn nào lúc lỗi.
2. Đầu ra có dòng `chưa giả lập: GET /v1/…`: thêm `backend.on(...)` cho từng API đó. Luồng không được dựa vào câu trả lời 404.
3. **Mở từng file PNG và nhìn**. Kiểm tra: đúng màn mong muốn; không còn vòng xoay hay khung chờ tải; không có lớp phủ dev; không có thông báo lỗi ngoài ý muốn; chữ không bị cắt; dữ liệu trông thật; ngày giờ không đổi giữa hai lần chạy.
4. Chạy lại lần hai để chắc luồng ổn định, không lúc được lúc không.
5. `npm run typecheck`.

Bí timeout mà không rõ vì sao: chạy thêm `--headed`, hoặc nhờ người dùng chạy `--headed --pause-on-step <stepId>` để nhìn trình duyệt tại đúng bước đó.

## 6. Sửa luồng đang lỗi

1. Chạy riêng luồng đó với `--no-figma`, đọc `errorLog` và mở `errorScreenshot`.
2. So nhãn và cấu trúc trong ảnh với locator trong file luồng và helper; đối chiếu với mã nguồn app hiện tại.
3. Sửa ở nơi dùng chung (helper) nếu nhiều luồng cùng dính; rồi chạy lại cả nhóm bằng tiền tố để chắc không làm hỏng luồng khác.
4. Không đổi `stepId` của các bước đang có.

## 7. Hoàn tất

1. Cập nhật bảng luồng ở mục 8 của README (nhóm, id, số màn).
2. Báo cho người dùng: các luồng đã thêm hoặc sửa, số màn mỗi luồng, thư mục ảnh, và điều gì bạn chưa kiểm chứng được.
3. Hỏi họ có muốn đưa sang Figma không. Có thì làm theo skill `chup-luong` từ bước 4.
