# 2026-11-13 · pixel-search 像素素材来源核查与登记

## 用户指示

> 「pixel-search的素材图对我有帮助，请记录一下」

本轮**只做记录**：未下载任何素材、未引入图片、未改渲染层、未增加包体、未动玩法与测试，也没有重建微信产物。

## 一、指的是哪一个 pixel-search

同名对象有三个，按「素材图」这一线索排除后确认是 Hugging Face 的像素精灵图检索工具：

| 候选 | 是什么 | 是否符合 |
|---|---|---|
| `huggingface.co/spaces/cfahlgren1/pixel-search` | Pixel Search，浏览器内像素图语义检索 | ✅ 本条所指 |
| `Angais/pixel-art-atlas-1.4m` | 上述 Space 的底层数据集 | ✅ 素材本体 |
| npm 包 `pixel-search` | 在大图中找小图 / 截图的 Node CLI | ❌ 与素材无关 |
| 安卓 App「Pixel Search」 | 通用搜图/文件检索工具 | ❌ 与素材无关 |

中文社区对该工具的报道描述为：有人发布 140 万张像素精灵图数据集，Hugging Face 员工基于它做了一个搜索工具。与 Space README 的规模数字一致。

## 二、Space 核查（`cfahlgren1/pixel-search`）

- 标题 `Pixel Search`，作者 `cfahlgren1`，状态 Running，`sdk: static`，应用入口 `build/index.html`。
- 定位原文：`Instant semantic search over pixel art, in your browser`；`Type a word, and thousands of 16×16 sprites re-arrange by meaning on every keystroke.`
- 覆盖范围：`Angais/pixel-art-atlas-1.4m` 的 **1,409,404 sprites** 与 **6,194 subjects**。
- 检索链路（全部在浏览器 Web Worker 中）：term lookup（未完成单词做 prefix / typo 补全）→ 对 6,194 个 subject 做 96 维 int8 点积暴力打分 → 按 caption 属性重排（如 `red dragon` 偏向 caption 含 red 的图）→ `OffscreenCanvas` + WebGL2 instancing 绘制，动画在 vertex shader。
- 离线管线：五个开源 encoder 对约 35k 词与 6,194 主题生成向量，PCA 压到 96 维、int8 存储；`pipeline/` 下有 `build_vocab.py` / `embed_all.py` / `select_sprites.py` / `build_data.py` / `build_catalog.py`，`scripts/eval.ts` 用人工标注查询集评分。
- 查询「模型」本质是查表：`The query "model" is a lookup table`，词向量取均值。README 未列出五个 encoder 的名称、权重与合并方式，只提示 `See LICENSES/ for notices`。
- **能力边界**：README 未说明支持以图搜图、点选 sprite 找相似、结果下载/导出/API。它是「浏览与找参考图」的工具，不是一键素材包；Space 页面本身也未披露许可条款。

## 三、数据集核查（`Angais/pixel-art-atlas-1.4m`）

- 名称 `Pixel Art Atlas · 1.4M Synthetic Sprites`，发布者 `Angais`。
- 规模：**1,409,404** 条（train 1,405,308 + validation 4,096），源数据 1,412,908，过滤掉 3,504 条；覆盖 **6,194 training subjects**；Parquet，总约 **694MB**；近月下载约 4.8 万。
- 形态：**逐张独立的 16×16 RGBA 透明底精灵图，不是 sprite sheet**。名称里的 Atlas 与 banner（精选样例，非随机质量样本）容易造成误解。字段为 `image / caption / subject / row_id`；另有 `tokens.npy`（每行 256 个调色板索引，0 为透明）、`palette.npy`、`split.npy`。
- 生成方式：`The images were generated from text prompts with Krea 2 Turbo and a pixel art LoRA`；元数据标签含 `Synthetic` / `ai-generated`；`No model weights or LoRA parameters are distributed here.`
- 质量免责：caption 描述的是「生成器被要求画什么」，图文一致性未系统审核（可能出现 caption 写 unlit、图却是点亮的蜡烛），颜色/材质/数量也可能不符；train/validation 划分继承自原训练项目，不保证主题未见。

## 四、授权边界（最重要的记录）

| 项 | 页面事实 |
|---|---|
| 元数据 | `license: cc0-1.0` |
| 权利声明 | `Angais releases the sprites, captions and collection under CC0 1.0 to the extent of the rights Angais can waive.` |
| 明确排除 | `This dedication does not grant rights in third-party material, trademarks, or Krea's models.` |
| 商用条款 | `This release does not override that agreement, its commercial-use provisions (§2.3), or the Krea Acceptable Use Policy.` |
| 输出归属 | 页面引用 Krea 2 Community License §5.3，称 Krea 不对生成输出主张所有权 |
| 官方关系 | `This is an independent dataset, not an official or endorsed Krea release.` |
| 署名 | 未发现强制署名要求；`Buy Me a Coffee` 为可选支持，非使用条件 |

**结论**：CC0 字段不是无条件商用保证。若要把其中任何一张图打进微信小游戏包，必须先核对 Krea 2 Community License §2.3 / §5.3 与 Krea AUP，确认不涉及第三方材料与商标，并留存来源记录（数据集、row_id / subject、核查日期）。仅当这些都通过，才进入接入流程。

## 五、与本项目现状的对照

- 现有素材：`assets/resources` 共 **59 张 png**（56 张八方向鸭 idle/walk ＋ 3 张敌人 `glove` / `clip` / `lid`），约 488KB；由 `loadDuck()` 读 `duck/manifest`、`loadEnemies()` 直接加载，`Texture2D.Filter.NEAREST` 保持像素锐利。
- 经典模式 `updateDuck()` / `updateEnemies()` 与割草模式 `updateDuck()` / `updateMowEnemies()` **都在用这些贴图**；割草模式把 3 张敌人图映射给 grunt / runner / brute，最多 190 个 Sprite。
- 纯手绘、无贴图的部分：待救小鸭、魂珠、剑气、粒子、伤害数字、结算演出，以及整个网页试玩页 `preview/mow.html`。后者与微信端观感分叉，是当前最明显的「像素感缺失」来源。
- 因此 pixel-search 的潜在用途是**补静态素材与参考图**：新敌人/精英/Boss 造型、道具与魂珠图标、UI 像素元件、场景 tile、以及统一画风的参考板。16×16 需整数倍放大并沿用 `NEAREST`，才能与现有 48px 精灵尺寸匹配。

## 六、接入前的合规与工程检查清单（未来触发时执行）

1. 核对 Krea 2 Community License §2.3 商用范围、§5.3 输出归属与 Krea AUP，保存条款快照与核查日期。
2. 逐张目视确认，不依赖 caption；记录 subject / row_id，排除疑似商标、第三方角色或现实 IP 的图。
3. 先挑 10–20 张小样，比对尺寸（16×16 → 整数倍）、调色板与现有 `Q` / `PAL` 配色、透明通道与边缘。
4. 确认不破坏现有 `assets/resources` + `duck/manifest` 加载流程；接入后复验微信产物包体与 `NEAREST` 效果。
5. 网页试玩页若要同步贴图，须与微信端共用同一份素材，避免继续分叉。
6. 每一步都单独提交，便于回溯单张素材的来源。

## 七、与同类工具的分工

| 工具 | 定位 | 当前状态 |
|---|---|---|
| `pixelfx` | 代码绘制像素特效 + `act` hit-stop 时序 | 已登记 [ROADMAP](../ROADMAP.md) 备选方案节，未实施；Cocos 微信运行时无 DOM `ImageData` |
| `animista` | CSS keyframes 与缓动曲线，适合 HTML UI 动效 | 2026-11-13 已评估，未正式登记；对 Cocos Canvas 不可直接用，曲线可作为纯数据参考 |
| `pixel-search` | 静态像素精灵图与参考图检索 | 本轮登记为素材来源，未引入 |

三者都不改变当前「特效由程序化绘制、素材只用于角色与敌人」的渲染模型。

## 八、本轮变更文件

- `docs/ROADMAP.md`：新增「素材与参考资源（2026-11-13 登记）」节。
- `CHANGELOG.md`：追加本轮条目。
- `docs/archive/2026-11-13-pixel-search-resource.md`：本文件。
- 未改动：`assets/**`、`preview/**`、`tools/**`、`tests/**`、构建产物与配置。
