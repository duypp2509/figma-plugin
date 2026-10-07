// Milestone check for the plugin: sends three fixed images as one flow, no browser involved.
// The third is taller than Figma's 4096 px limit, so it arrives as several tiles.
import { FigmaClient } from "../capture/figma-client";
import { sliceImage } from "../capture/tiles";
import { DEFAULT_PORT } from "../shared/types";
import { makeTestImage } from "./test-images";

const DPR = 2;
const viewport = { width: 1440, height: 900 };
const flowId = "test-3-anh";
const steps = [
  { stepId: "do", title: "Ảnh đỏ 1440×900", height: 900, color: [239, 68, 68] },
  { stepId: "xanh-la", title: "Ảnh xanh lá 1440×900", height: 900, color: [34, 197, 94] },
  { stepId: "xanh-duong", title: "Ảnh xanh dương cao 1440×5000", height: 5000, color: [59, 130, 246] },
] as const;

const client = await FigmaClient.connect(Number(process.env.FFC_PORT ?? DEFAULT_PORT), console.log);
try {
  await client.waitForPlugin(120_000, console.log);
  await client.flowStart({
    type: "flow_start", flowId, flowName: "Kiểm tra · 3 ảnh cố định", viewport, dpr: DPR,
    layout: { gap: 120, padding: 120, sectionGap: 400, arrows: true },
  });
  for (const [stepIndex, step] of steps.entries()) {
    const image = sliceImage(makeTestImage(viewport.width * DPR, step.height * DPR, [...step.color]));
    await client.step({ flowId, stepIndex, stepId: step.stepId, title: step.title, frameName: `SuperShip - ${step.title.toLocaleUpperCase("vi-VN")}` }, image);
    console.log(`đã gửi bước ${stepIndex + 1}/${steps.length}: ${step.title} (${image.tiles.length} lát)`);
  }
  await client.flowEnd({ type: "flow_end", flowId, status: "complete", totalSteps: steps.length });
  console.log("Xong. Trong Figma phải thấy 1 Section có 3 frame xếp ngang, 2 mũi tên, frame thứ ba cao 5000 px và liền mạch.");
} catch (error) {
  console.error(`Lỗi: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await client.close();
}
