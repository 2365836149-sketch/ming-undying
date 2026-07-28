# 装备贴图画风 Prompt（统一版）

## 核心英文 Prompt（可直接套用）

```
Chunky 16-bit pixel art game inventory icon, STRICTLY grayscale (black / white / gray only, no color).
Thick solid black outlines (about 2px), heavy dark shadows, high contrast, bold readable silhouette.
Simple forms, limited gray shades, not high-detail, not smooth, not painterly.
Single centered object, solid flat chroma-key bright green background #00FF00 only.
No ground shadow, no environment, no UI, no English text unless specified.
Final look should read clearly at 192x192 after nearest-neighbor pixelation.
```

## 中文要点

1. **像素风**：粗颗粒 16-bit，像低分辨率放大，不要细腻写实。
2. **灰阶**：只准黑白灰，不要彩色。
3. **线条**：外轮廓加粗、实心黑边；内部结构线也偏粗。
4. **阴影**：阴影要深、对比要强；高光克制，整体偏暗沉。
5. **形制**：单件物体居中，轮廓清楚，适配格子背包。
6. **抠图底**：纯绿幕 `#00FF00`，无地面投影、无场景。
7. **文字**：若有汉字，用少量大字；可略糊，忌英文（蜂蜜只用「蜜」）。
8. **后期**：生成后可再压暗中灰、加深暗部，并用外轮廓加黑边统一。

## 按类补充

- **冷兵器**：形制准确（硬鞭=铁棍竹节，勿画皮鞭/流星锤；八斩刀=宽刃+D护手带钩）。
- **火器**：明代形制（三眼铳=品字三管+长木柄；鸟铳=长管火绳机；迅雷铳=多管+大圆盾+光杆；掣电铳=后膛换子铳鸟铳形；快枪=长枪枪头下加铳管）。
- **甲胄**：与棉甲/鱼鳞甲同款粗线深阴影，重形制不只贴材质。
- **卷轴**：密旨抄件为双头卷轴，繁体「密旨」。

## 负向词（尽量避免）

```
color, colorful, realistic photo, soft shading, thin lines, high detail, modern gun,
leather whip, chain flail, pistol grip, English text, watermark, complex UI
```
