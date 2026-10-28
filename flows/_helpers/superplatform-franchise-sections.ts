/**
 * Figma Sections of the franchise and post office work in SuperPlatform: one parent Section, and one numbered
 * child Section per feature in the order a person meets them. The folders under flows/superplatform-nhuong-quyen-buu-cuc
 * carry the same numbers, so the child Sections are created, and therefore stacked, in this order.
 */
export const FRANCHISE_ROOT = "SUPERPLATFORM — NHƯỢNG QUYỀN VÀ BƯU CỤC";

const SECTIONS = {
  "danh-sach": "01. DANH SÁCH TỔ CHỨC",
  "nhuong-quyen": "02. THÊM ĐỐI TÁC NHƯỢNG QUYỀN",
  "buu-cuc": "03. MỞ BƯU CỤC",
  "ho-so": "04. HỒ SƠ TỔ CHỨC",
  "phap-ly": "05. THÔNG TIN PHÁP LÝ",
  "nguoi-dai-dien": "06. NGƯỜI ĐẠI DIỆN",
  "lien-he": "07. LIÊN HỆ CỦA TỔ CHỨC",
  "dia-chi": "08. ĐỊA CHỈ CỦA TỔ CHỨC",
  "loai-hinh": "09. ĐỔI LOẠI HÌNH BƯU CỤC",
  "trang-thai": "10. TẠM NGƯNG, KÍCH HOẠT LẠI, NGỪNG HOẠT ĐỘNG",
} as const;

export type FranchiseSection = keyof typeof SECTIONS;

export const franchiseGroup = (section: FranchiseSection): [string, ...string[]] => [FRANCHISE_ROOT, SECTIONS[section]];
