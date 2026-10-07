import { DEFAULT_PORT } from "../shared/types";
import { startRelay } from "./relay";

const port = Number(process.env.FFC_PORT ?? DEFAULT_PORT);

try {
  await startRelay(port);
  console.log(`[relay] đang chạy ở ws://127.0.0.1:${port} — mở plugin "Flow Capture" trong Figma desktop để kết nối. Ctrl+C để dừng.`);
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  console.error(code === "EADDRINUSE"
    ? `[relay] cổng ${port} đang được dùng — có thể server đã chạy sẵn ở cửa sổ khác.`
    : `[relay] không khởi động được: ${(error as Error).message}`);
  process.exit(1);
}
