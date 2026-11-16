# 成品预览源模型

wizard-duck.glb 是用户提供 model (1).glb 的轻量副本，2,770,364字节、31,050三角面，保留UV/贴图。原始24MB文件不进入Git，副本不代表原网格已经水密修复。SHA256与转换数据见 ../color-clear/ready/wizard-report.json。

此文件只用于法师鸭成品页的完整实体预览/下载；游戏运行只加载3000块的关卡JSON（650格基线仍保留）。离线体素源生成工具见 tools/prepare-wizard-duck.py（仓库根目录），构建成品页使用已提交的细胞JSON，无需Python环境。

离线重建可在独立Python环境安装 tools/model-tools-requirements.txt，再执行 `python tools/prepare-wizard-duck.py --source /自己的路径/model.glb`。默认读取仓库轻量GLB；源文件仅用于统计/哈希，不会被覆盖。
