# 转转积木：真3D消除原型

2026-11-16。独立于旧 GoDuck 的玩法实验；名称为工作名。

## 现在怎么玩

- 直接打开 [自包含试玩文件](../preview/color-clear.html)，不依赖CDN；桌面Chrome也可离线打开。
- 或在仓库执行 `npm ci`、`npm run preview:build`、`npm run preview:serve`，访问 `http://127.0.0.1:4179/preview/color-clear.html`。服务只绑定本机，不是公开网址，手机不能用这个地址直接访问电脑。
- 点击前排胶囊入4个发射槽，多个胶囊同时自动清除同色可见块；左右拖动模型改变目标，松手有短暂且受限的惯性。后排仅作预览，空槽可随时补充。
- 白环是连锁核心，可见核心附近的浅色线框提示清除范围。点击、命中、连锁、完成各有声音；声音默认开，可关闭。振动默认关，设备不支持时不影响游玩。
- 没有倒计时。暂停、帮助、重开、胜负说明、下一关、已解锁关卡选择均可用；本地保存解锁进度和声音偏好，不接账号或广告。

## 实现与关卡

- `assets/scripts/color-clear/ColorClearGame.ts`：纯规则、真实遮挡、旋转、槽位/弹药、连锁及失败判断。
- `ColorClearLevels.ts`：10个原创程序化体素造型。预先模拟一条解法，按这条路径确定胶囊颜色、弹量和列顺序；进入游戏后不改色、不动态改难度。它是可解性验证，不代表关卡已完成真人难度调优。
- `preview/color-clear/`：Three.js真WebGL渲染；共享规则，使用实例网格与有上限的碎片。模型不是图片，游戏中的旋转和可见面命中对应。
- `preview/color-clear.html`：构建后的单文件试玩，含Three.js MIT许可，约567KiB；原生浏览器入口，不是Cocos导出的微信包。
- `ColorClearView.ts`：Cocos组件适配代码，与网页共用规则和关卡；当前未通过Creator导入和运行验证。网页视觉与适配器不保证逐像素相同。
- `assets/resources/color-clear-audio/*.wav`：本项目程序合成的5个短音效；可用 `node tools/generate-color-clear-audio.mjs` 重建。Creator自动导入后供AudioSource读取。

为了让规则、画面及所有角度死局判断一致，当前使用水平正交相机，围绕Y轴旋转。逻辑中心射线以完整单位积木判断遮挡，视觉积木略缩小留缝；缝隙不作为可射击通道。不是任意俯仰的自由观察器，不需要点选模型的某个小方块。

## Cocos 3.8.8 接续步骤（尚未执行）

这台设备未发现Creator/MCP，不能完成 `.scene`、`.meta` 的安全编辑、引擎类型诊断和真实构建。因此没有手工写场景或meta，没有冒称已发布微信小游戏。

1. 在已安装Creator 3.8.8的设备拉取最新仓库，打开工程等待脚本和WAV自动导入，保存自动生成的meta。
2. 已新增名为 `colorClear` 的引擎配置，开启3D和primitive、关闭重物理；旧 `defaultConfig` 内容与当前选中状态保持不变。可用 `node tools/prepare-color-clear-cocos.mjs --check` 核查；若新设备缺配置，`--apply` 只添加，不切换。
3. 在Creator项目设置/引擎配置中选择 `Color Clear 3D 原型`，新建独立空场景，使用编辑器命名保存为 `ColorClear.scene`。移除新场景默认相机与灯光以免覆盖组件自建相机；不要改Home场景。
4. 新建空节点，挂 `ColorClearView`，组件会建立模型、相机、灯光与2D UI。用Creator确认类型/API、相机合成、触摸区、合批、音频导入与完整关卡；本机只做了脚本语法转译检查，不等同于这一步。
5. 以新场景为入口构建独立微信小游戏产物，竖屏；核查包体与微信限制，实际iPhone真机试玩并测帧率、温度与输入。旧Home继续使用旧2D引擎配置；不要把新配置作为旧基线性能优化已验证结果。

## 验证与已知边界

`npm test`（规则/旧项目回归）、`npm run check:color-clear`（共享规则严格类型检查）、`npm run preview:build`。
浏览器自动检查：先启动本机预览服务，再 `npx playwright install chromium` 与 `npm run test:color-clear-ui`；也可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向已有测试浏览器。本轮使用独立无头Chrome，不操纵用户日常浏览器窗口。

当前已验证实际点击发射、拖动/惯性、暂停重开、第一关胜利、下一关和多种屏幕布局；具体最终验证见[实施记录](archive/2026-11-16-color-clear-implementation-session.md)。Node在当前CommonJS项目中直接读取新增ES模块TS会给出MODULE_TYPELESS_PACKAGE_JSON提示，不影响测试；没有为去掉提示改变旧项目模块类型。

未验证：Cocos实际编译/运行、微信包、iPhone真机、长时间性能、玩家是否愿意反复玩；关卡尚未做真人难度与公平性调优。模型是程序积木造型，不是竞品模型或AI概念图资产。无后台、广告SDK、分享奖励、体力限制或线上部署。
