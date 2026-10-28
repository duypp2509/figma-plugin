import {
  addressDialog, addressFlow, choose, editButton, expect, field, fillAddress, historyDialog, openAddressEdit, openHistory,
  openSection, pickDay, save,
} from "../../_helpers/superplatform-unit-contacts";
import { FRANCHISE_ID, MESSAGES, OLD_SERVICE_POINT, POST_OFFICE_ID, openOverview, toast } from "../../_helpers/superplatform-unit-profile";

const HISTORY = "Lịch sử địa chỉ";
const SP = "SERVICE_POINT", OFFICE = "TRANSACTION_OFFICE";

export default [
  addressFlow({
    id: "dia-gioi-cu", name: "01. XEM ĐỊA CHỈ, ĐỊA CHỈ THEO ĐỊA GIỚI CŨ",
    setup: units => { units[POST_OFFICE_ID]!.addresses[SP] = OLD_SERVICE_POINT; },
    async run({ page, shot, mock }) {
      await openSection(page, POST_OFFICE_ID, "addresses");
      await page.getByText(MESSAGES.oldRegion, { exact: true }).waitFor();
      await shot("dia-gioi-cu", "Địa chỉ còn quận, huyện: hãy cập nhật");

      await openAddressEdit(page, SP);
      await expect(field(page, `addresses.${SP}.address_line`)).toHaveValue("Số 12 đường Văn Quán");
      await expect(page.locator(`[data-field="addresses.${SP}.province_code"] [role="combobox"]`)).toContainText("Chọn Tỉnh/ Thành phố");
      await shot("chon-lai", "Sửa: tỉnh, phường xã để trống, chọn lại theo địa giới mới");

      await fillAddress(page, SP, "Thành phố Hà Nội", "Phường Hà Đông");
      await shot("da-chon", "Đã chọn Thành phố Hà Nội, Phường Hà Đông");

      await save(addressDialog(page));
      await toast(page, "Đã lưu địa chỉ.").waitFor();
      await addressDialog(page).waitFor({ state: "hidden" });
      await page.getByText("Số 12 đường Văn Quán, Phường Hà Đông, Thành phố Hà Nội", { exact: true }).waitFor();
      await expect(page.getByText(MESSAGES.oldRegion, { exact: true })).toHaveCount(0);
      await shot("da-luu", "Đã lưu: hết dòng nhắc");
      expect(mock.writes).toBe(1);
    },
  }),
  addressFlow({
    id: "doi-diem-phuc-vu", name: "02. CẬP NHẬT ĐỊA CHỈ ĐIỂM PHỤC VỤ",
    async run({ page, shot, mock }) {
      await openSection(page, POST_OFFICE_ID, "addresses");
      await editButton(page).waitFor();
      await shot("dia-chi", "Địa chỉ của bưu cục");

      await openAddressEdit(page, SP);
      await expect(page.locator(`[data-field="addresses.${SP}.ward_code"] [role="combobox"]`)).toContainText("Phường Hà Đông");
      await shot("hop-sua", "Hộp Sửa địa chỉ, điền sẵn địa chỉ hiện tại");

      await field(page, `addresses.${SP}.address_line`).fill("Số 40 đường Văn Quán");
      await field(page, `addresses.${SP}.address_line`).blur();
      await shot("da-sua", "Dời sang số 40, cùng phường");

      await save(addressDialog(page));
      await toast(page, "Đã lưu địa chỉ.").waitFor();
      await addressDialog(page).waitFor({ state: "hidden" });
      await page.getByText("Số 40 đường Văn Quán, Phường Hà Đông, Thành phố Hà Nội", { exact: true }).waitFor();
      await shot("da-luu", "Đã lưu địa chỉ");

      await openOverview(page, POST_OFFICE_ID);
      await page.getByText("Số 40 đường Văn Quán, Phường Hà Đông, Thành phố Hà Nội", { exact: true }).waitFor();
      await shot("tong-quan", "Ô Địa chỉ ở Tổng quan hiện địa chỉ mới, mã đơn vị giữ nguyên");
      expect(mock.writes).toBe(1);
    },
  }),
  addressFlow({
    id: "them-van-phong", name: "03. THÊM VĂN PHÒNG GIAO DỊCH CHO NHƯỢNG QUYỀN",
    setup: units => { units[FRANCHISE_ID]!.addresses[OFFICE] = null; units[FRANCHISE_ID]!.addressHistory = []; },
    async run({ page, shot, mock }) {
      await openSection(page, FRANCHISE_ID, "addresses");
      await page.getByText("Chưa có", { exact: true }).waitFor();
      await shot("chua-co", "Nhượng quyền chưa có văn phòng giao dịch");

      await openAddressEdit(page, OFFICE);
      await fillAddress(page, OFFICE, "Thành phố Hà Nội", "Phường Kiến Hưng", "Tầng 3, số 8 Tố Hữu");
      await field(page, `addresses.${OFFICE}.address_line`).blur();
      await shot("da-nhap", "Nhập văn phòng giao dịch");

      await save(addressDialog(page));
      await toast(page, "Đã lưu địa chỉ.").waitFor();
      await addressDialog(page).waitFor({ state: "hidden" });
      await page.getByText("Tầng 3, số 8 Tố Hữu, Phường Kiến Hưng, Thành phố Hà Nội", { exact: true }).waitFor();
      await shot("da-luu", "Đã thêm văn phòng giao dịch");
      expect(mock.writes).toBe(1);
    },
  }),
  addressFlow({
    id: "nhap-thieu", name: "04. NHẬP THIẾU",
    setup: units => { units[FRANCHISE_ID]!.addresses[OFFICE] = null; },
    async run({ page, shot, mock }) {
      await openSection(page, POST_OFFICE_ID, "addresses");
      await openAddressEdit(page, SP);
      await field(page, `addresses.${SP}.address_line`).fill("");
      await save(addressDialog(page));
      await addressDialog(page).getByText(MESSAGES.line, { exact: true }).waitFor();
      await shot("thieu-dia-chi-chi-tiet", "Xóa trống địa chỉ chi tiết của điểm phục vụ");

      await openSection(page, FRANCHISE_ID, "addresses");
      await openAddressEdit(page, OFFICE);
      await choose(page, `addresses.${OFFICE}.province_code`, "Thành phố Hà Nội");
      await field(page, `addresses.${OFFICE}.address_line`).fill("Tầng 3, số 8 Tố Hữu");
      await save(addressDialog(page));
      await addressDialog(page).getByText(MESSAGES.ward, { exact: true }).waitFor();
      await shot("thieu-phuong-xa", "Văn phòng giao dịch chưa chọn phường, xã");
      expect(mock.writes).toBe(0);
    },
  }),
  addressFlow({
    id: "lich-su", name: "05. XEM LỊCH SỬ ĐỊA CHỈ",
    async run({ page, shot }) {
      await openSection(page, POST_OFFICE_ID, "addresses");
      await openHistory(page, HISTORY);
      const dialog = historyDialog(page, HISTORY);
      await expect(dialog.locator("ol li")).toHaveCount(2);
      await shot("tat-ca", "Lịch sử địa chỉ: địa giới cũ, rồi địa chỉ theo địa giới mới");

      await pickDay(dialog, "Từ ngày", "2025-07-01");
      await expect(dialog.locator("ol li")).toHaveCount(1);
      await shot("loc-tu-ngay", "Lọc từ 01/07/2025");
    },
  }),
];
