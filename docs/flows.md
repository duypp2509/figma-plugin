# Flow catalog

Flows by group, with the command that captures the whole group and the parent Section it lands in on Figma. All flows use the `desktop` viewport (1440 × 900, 2× images).

For the authoritative per-flow list (ids, names, Figma Section paths), run:

```powershell
.\capture --list          # human-readable
.\capture --list --json   # for scripts and agents
```

Every flow except `dang-ky-shop` runs against a backend mocked inside the browser: it creates no accounts or records, sends no OTP, and can be re-run any number of times. Error messages in failure branches are copied from the backend source, and flows that show dates or countdowns freeze the page clock so screenshots are stable across runs.

## SuperShip Web (`supership`)

| Group | Folder | Command | Flows | Parent Section in Figma |
| --- | --- | --- | --- | --- |
| Shop registration (mocked) | `flows/` | `--flow dang-ky-shop-mock` | 1 | none |
| Shop registration (real backend) ⚠ | `flows/` | `--flow dang-ky-shop` | 1 | none |
| Forgot password | `quen-mat-khau/` | `--flow "quen-mat-khau*"` | 11 | `QUÊN MẬT KHẨU - ĐẶT LẠI MẬT KHẨU DÙNG OTP QUA SMS` / `… QUA ZALO` |
| Accept shop invitation (new user) | `loi-moi-tham-gia-shop/` | `--flow "loi-moi-shop*"` | 11 | `CHẤP NHẬN LỜI MỜI THAM GIA SHOP (CHƯA CÓ TÀI KHOẢN) - XÁC THỰC OTP QUA SMS` / `… QUA ZALO` |
| My invitations | `loi-moi-cua-toi/` | `--flow "loi-moi-cua-toi*"` | 6 | `LỜI MỜI THAM GIA CỦA TÔI` |
| Email verification | `thong-tin-tai-khoan/` | `--flow "xac-thuc-email*"` | 3 | `THÔNG TIN TÀI KHOẢN - XÁC THỰC EMAIL` |
| Shop information | `thong-tin-cua-hang/` | `--flow "thong-tin-cua-hang*"` | 3 | `THÔNG TIN CỬA HÀNG` |
| Shop members | `thanh-vien-shop/` | `--flow "thanh-vien-shop*"` | 28 | `THÀNH VIÊN CỬA HÀNG` |
| Shop roles | `vai-tro-shop/` | `--flow "vai-tro-shop*"` | 2 | `QUẢN LÝ VAI TRÒ CỦA SHOP` |
| Custom shop roles | `vai-tro-rieng/` | `--flow "vai-tro-rieng*"` | 5 | `VAI TRÒ RIÊNG CỦA SHOP` |
| Screen lock PIN | `supership-pin/` | `--flow "supership-pin*"` | 9 | `SUPERSHIP WEB → KHÓA MÀN HÌNH BẰNG MÃ PIN` |

## SuperPlatform (`superplatform`)

| Group | Folder | Command | Flows | Parent Section in Figma |
| --- | --- | --- | --- | --- |
| Sign-in | `superplatform-dang-nhap/` | `--flow "superplatform-dang-nhap*"` | 57 | `SUPERPLATFORM → ĐĂNG NHẬP` (8 sub-Sections) |
| Internal forgot password | `superplatform-quen-mat-khau/` | `--flow "superplatform-quen-mat-khau*"` | 12 | `SUPERPLATFORM → QUÊN MẬT KHẨU NỘI BỘ` |
| Identity document (CCCD) | `superplatform-cccd/` | `--flow "superplatform-cccd*"` | 10 | `SUPERPLATFORM → XÁC THỰC ĐỊNH DANH (CCCD)` |
| My profile | `superplatform-ho-so-cua-toi/` | `--flow "superplatform-ho-so-cua-toi*"` | 26 | `SUPERPLATFORM → HỒ SƠ CỦA TÔI` (4 sub-Sections) |
| My invitations | `superplatform-loi-moi-cua-toi/` | `--flow "superplatform-loi-moi-cua-toi*"` | 7 | `SUPERPLATFORM → LỜI MỜI CỦA TÔI` |
| Two-factor settings | `superplatform-mfa-cai-dat/` | `--flow "superplatform-mfa-cai-dat*"` | 4 | `SUPERPLATFORM → QUẢN LÝ XÁC THỰC HAI LỚP` |
| Screen lock PIN | `superplatform-pin/` | `--flow "superplatform-pin*"` | 21 | `SUPERPLATFORM → KHÓA MÀN HÌNH BẰNG MÃ PIN` |
| Idle sign-out policy | `superplatform-idle-policy/` | `--flow "superplatform-idle-policy*"` | 9 | `SUPERPLATFORM → CHÍNH SÁCH TỰ ĐĂNG XUẤT` |
| Login lockout policy | `superplatform-login-lockout/` | `--flow "superplatform-login-lockout*"` | 4 | `SUPERPLATFORM → CHÍNH SÁCH KHÓA ĐĂNG NHẬP` |
| Document reading settings | `superplatform-cau-hinh-giay-to/` | `--flow "superplatform-cau-hinh-giay-to*"` | 4 | `SUPERPLATFORM → CẤU HÌNH GIẤY TỜ` |
| Verification requests | `superplatform-yeu-cau-xac-minh/` | `--flow "superplatform-yeu-cau-xac-minh*"` | 12 | `SUPERPLATFORM — YÊU CẦU XÁC MINH` |
| Franchises and post offices | `superplatform-nhuong-quyen-buu-cuc/` | see below | 89 | `SUPERPLATFORM — NHƯỢNG QUYỀN VÀ BƯU CỤC` (11 sub-Sections) |

### Franchises and post offices

Sub-Section names are declared once in `flows/_helpers/superplatform-franchise-sections.ts`. Folders are numbered so the sub-Sections are built in business order.

| Sub-Section | Folder | Id prefix | Flows |
| --- | --- | --- | --- |
| `01. DANH SÁCH TỔ CHỨC` | `01-danh-sach` | `superplatform-danh-sach-` | 8 |
| `02. THÊM ĐỐI TÁC NHƯỢNG QUYỀN` | `02-them-nhuong-quyen` | `superplatform-nhuong-quyen-` | 9 |
| `03. MỞ BƯU CỤC` | `03-mo-buu-cuc` | `superplatform-buu-cuc-` | 6 |
| `04. HỒ SƠ TỔ CHỨC` | `04-ho-so` | `superplatform-ho-so-` ¹ | 9 |
| `05. THÔNG TIN PHÁP LÝ` | `05-phap-ly` | `superplatform-phap-ly-` | 11 |
| `06. NGƯỜI ĐẠI DIỆN` | `06-nguoi-dai-dien` | `superplatform-nguoi-dai-dien-` | 10 |
| `07. LIÊN HỆ CỦA TỔ CHỨC` | `07-lien-he` | `superplatform-lien-he-` | 6 |
| `08. ĐỊA CHỈ CỦA TỔ CHỨC` | `08-dia-chi` | `superplatform-dia-chi-` | 5 |
| `09. ĐỔI LOẠI HÌNH BƯU CỤC` | `09-loai-hinh` | `superplatform-loai-hinh-` | 3 |
| `10. TẠM NGƯNG, KÍCH HOẠT LẠI, NGỪNG HOẠT ĐỘNG` | `10-trang-thai` | `superplatform-trang-thai-` | 8 |
| `11. MỜI QUẢN LÝ NHƯỢNG QUYỀN, TRƯỞNG BƯU CỤC` | `11-quan-ly` | `superplatform-quan-ly-`, `superplatform-truong-buu-cuc-` | 14 |

¹ `superplatform-ho-so-*` also matches the 26 *My profile* flows (`superplatform-ho-so-cua-toi-*`).

Capture the whole group in order:

```powershell
.\capture --no-figma --flow "superplatform-danh-sach-*" --flow "superplatform-nhuong-quyen-*" --flow "superplatform-buu-cuc-*" --flow "superplatform-ho-so-*" --flow "superplatform-phap-ly-*" --flow "superplatform-nguoi-dai-dien-*" --flow "superplatform-lien-he-*" --flow "superplatform-dia-chi-*" --flow "superplatform-loai-hinh-*" --flow "superplatform-trang-thai-*" --flow "superplatform-quan-ly-*" --flow "superplatform-truong-buu-cuc-*"
```

## Flows with side effects

`dang-ky-shop` runs against the real development backend. **Every run creates a new account and shop** and uses one of the 50 daily OTPs. The local app uses a real captcha sitekey, so it must run with `--headed` and the captcha must be solved by hand within 3 minutes. It is excluded from `--all` and prefix selections; use `dang-ky-shop-mock` for routine captures.

## Removed flows

When a flow is deleted from the repository, its Section stays in Figma and must be deleted by hand. Steps removed from a flow are deleted automatically on the next complete run (or kept with the `⚠ không còn trong luồng` prefix if that plugin option is off).
