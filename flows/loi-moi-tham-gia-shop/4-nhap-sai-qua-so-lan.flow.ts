import { defineFlow } from "../../capture";
import {
  CHANNELS, INVITATION_STEP, continueButton, dialogSaying, dismissErrorNotice, goToCodeStep, groupName, mockMemberInvitation,
  openInvitation, submitCode, waitErrorNotice,
} from "../_helpers/supership-member-invitation";

// Five wrong codes block the OTP session and send the person back to the details form.
export default CHANNELS.map((channel) => defineFlow({
  id: `loi-moi-shop-${channel.toLowerCase()}-nhap-sai-qua-so-lan`,
  group: groupName(channel),
  name: "4. NHẬP SAI QUÁ SỐ LẦN QUY ĐỊNH",
  app: "supership",
  async run({ page, shot }) {
    await mockMemberInvitation(page);
    await openInvitation(page);
    await shot(...INVITATION_STEP, { mode: "fullPage" });

    await goToCodeStep(page, channel);

    // Each wrong code is reported in a notice that has to be acknowledged before the next try.
    const wrong = (left: number) => `Mã OTP không đúng. Bạn còn ${left} lần nhập.`;
    await submitCode(page, "111111");
    await waitErrorNotice(page, wrong(4));
    await shot("ma-sai-lan-1", "Nhập sai mã lần 1, còn 4 lần");
    await dismissErrorNotice(page, wrong(4));

    for (const [index, code] of ["222222", "333333", "444444"].entries()) {
      await submitCode(page, code);
      await waitErrorNotice(page, wrong(3 - index));
      if (index < 2) await dismissErrorNotice(page, wrong(3 - index));
    }
    await shot("ma-sai-lan-4", "Nhập sai mã lần 4, còn 1 lần");
    await dismissErrorNotice(page, wrong(1));

    // The fifth wrong code is refused like the others, and then the app says the code step is over.
    const refused = "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã OTP mới.";
    await submitCode(page, "555555");
    await waitErrorNotice(page, refused);
    await shot("ma-sai-lan-5", "Nhập sai mã lần 5, hết lượt nhập");
    // The app may already have replaced this notice with the one saying the code step is over.
    await dismissErrorNotice(page, refused, 3000).catch(() => undefined);

    const blocked = dialogSaying(page, "Vui lòng thực hiện lại từ đầu");
    await blocked.getByRole("heading", { name: "Nhập sai quá số lần cho phép" }).waitFor();
    await shot("sai-qua-so-lan", "Nhập sai quá số lần cho phép");

    await blocked.getByRole("button", { name: "Đã hiểu" }).click();
    await continueButton(page).waitFor();
    await shot("quay-ve-buoc-thong-tin", "Quay về bước thông tin tài khoản", { mode: "fullPage" });
  },
}));
