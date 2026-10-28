"""Build contact sheets and a local gallery for reviewing every captured policy screen."""
import json
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
report = json.loads((root / "captures/_last-run.json").read_text(encoding="utf-8"))
out = root / "captures/idle-policy-preview"
out.mkdir(exist_ok=True)
sections = []
for flow in report["flows"]:
    if not flow["id"].startswith("superplatform-idle-policy-"):
        continue
    paths = [root / path for path in flow["screenshots"]]
    sheet = Image.new("RGB", (1440, ((len(paths) + 1) // 2) * 490), "#e2e8f0")
    draw = ImageDraw.Draw(sheet)
    cards = []
    for index, path in enumerate(paths):
        with Image.open(path) as source:
            source.thumbnail((720, 450))
            x, y = (index % 2) * 720, (index // 2) * 490
            sheet.paste(source, (x, y + 35))
            draw.text((x + 12, y + 10), path.stem, fill="#0f172a")
        relative = "../" + path.relative_to(root / "captures").as_posix()
        cards.append(f'<figure><a href="{relative}"><img src="{relative}"></a><figcaption>{escape(path.stem)}</figcaption></figure>')
    name = flow["id"].split("@")[0]
    sheet.save(out / f"{name}.jpg", quality=94)
    sections.append(f'<section><h2>{escape(name)}</h2><div>{"".join(cards)}</div></section>')
(out / "index.html").write_text('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Chính sách tự đăng xuất — 40 màn</title><style>body{font:16px system-ui;margin:24px;background:#f1f5f9;color:#0f172a}section>div{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}figure{margin:0;background:white;padding:12px;border-radius:12px}img{width:100%;height:auto}figcaption{padding-top:8px}h2{font-size:20px;margin-top:40px}</style><h1>Chính sách tự đăng xuất — 9 luồng, 40 màn</h1><p>Nhấp ảnh để xem bản PNG đầy đủ. Dữ liệu giả lập, ảnh từ giao diện SuperPlatform.</p>'+"".join(sections)+'</html>', encoding="utf-8")
print(f"Generated {len(sections)} contact sheets: {out}")
