#!/usr/bin/env bash
# COCOS_CREATOR=/path/to/CocosCreator tools/build-wechat-rescue.sh
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
creator="${COCOS_CREATOR:-}"
output="${RESCUE_BUILD_OUTPUT:-$root/build/wechat-rescue}"
if [[ ! -x "$creator" ]]; then
  printf '请将 COCOS_CREATOR 指向 Creator 3.8.8 的可执行文件。\n' >&2
  exit 2
fi
if [[ -z "${WECHAT_APPID:-}" && -z "${WECHAT_PROJECT_CONFIG:-}" ]]; then
  export WECHAT_PROJECT_CONFIG="$root/tools/cocos/wechat-rescue.project.json"
fi
parent="$(dirname -- "$output")"
mkdir -p "$parent"
# Creator resolves module URLs to real paths during scene serialization.
parent="$(cd -- "$parent" && pwd -P)"
output="$parent/$(basename -- "$output")"
stage="$(mktemp -d "$parent/.rescue-stage.XXXXXX")"
project="$stage/project"
log="$stage/creator.log"
mkdir -p "$project"
printf '构建日志：%s\n' "$log"

# The scene and its UUIDs are copied as-is. Only the temporary project's
# GoDuck source is wired to the rescue runtime.
cp -R "$root/assets" "$root/settings" "$project/"
cp "$root/package.json" "$root/tsconfig.json" "$project/"
cp "$root/tools/cocos/RescueBootstrap.ts" "$project/assets/scripts/GoDuck.ts"
python3 - "$project/settings/v2/packages/engine.json" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
engine = json.loads(path.read_text())
modules = engine['modules']
profile = modules['configs']['colorClear']
if not set(['3d', 'primitive']) <= set(profile['includeModules']):
    raise SystemExit('colorClear 引擎配置缺少 3D 或基础几何模块')
modules['globalConfigKey'] = 'colorClear'
path.write_text(json.dumps(engine, indent=2) + '\n')
PY

code=0
env -u ELECTRON_RUN_AS_NODE -u NODE_OPTIONS "$creator" \
  --no-sandbox --disable-gpu --disable-gpu-sandbox --disable-dev-shm-usage \
  --project "$project" \
  --build 'platform=wechatgame;debug=false;md5Cache=true;outputName=wechatgame' \
  >"$log" 2>&1 || code=$?
if [[ "$code" != 0 && "$code" != 36 ]]; then
  printf 'Creator 构建失败（退出码 %s），查看 %s\n' "$code" "$log" >&2
  exit "$code"
fi
artifact="$project/build/wechatgame"
python3 - "$artifact" "$project/assets/Home.scene" <<'PY'
import json, os, re, sys
from pathlib import Path
root = Path(sys.argv[1])
if not (root / 'game.js').is_file():
    raise SystemExit('Creator 未生成 game.js')
# Creator can return success even if missing script classes were removed
# while serializing the launch scene. Reject that inert artifact.
scene = json.loads(Path(sys.argv[2]).read_text())
host = next(node for node in scene if node.get('__type__') == 'cc.Node' and node.get('_name') == 'GoDuck')
component_ids = [scene[ref['__id__']]['__type__'] for ref in host['_components']]
script_id = next(name for name in component_ids if not name.startswith('cc.'))
scene_fragments = (root / 'assets/main/import').rglob('*.json')
if not any(script_id in file.read_text() for file in scene_fragments):
    raise SystemExit('Creator 未在构建场景内保留救援入口脚本；请查看构建日志')
if not any('DuckRescue' in file.read_text() for file in root.rglob('*.js')):
    raise SystemExit('Creator 构建包内未找到救援启动代码')
pc_path = root / 'project.config.json'
game_path = root / 'game.json'
pc = json.loads(pc_path.read_text())
game = json.loads(game_path.read_text())
appid = os.getenv('WECHAT_APPID')
if not appid:
    config = json.loads(Path(os.environ['WECHAT_PROJECT_CONFIG']).read_text())
    if config.get('compileType') != 'game':
        raise SystemExit('所选配置不是微信小游戏')
    appid = config.get('appid')
if not isinstance(appid, str) or not re.fullmatch(r'wx[0-9a-fA-F]{16}', appid):
    raise SystemExit('微信小游戏 AppID 格式无效')
pc.update(appid=appid, compileType='game')
game['deviceOrientation'] = 'portrait'
pc_path.write_text(json.dumps(pc, ensure_ascii=False, indent=2) + '\n')
game_path.write_text(json.dumps(game, ensure_ascii=False, indent=2) + '\n')
PY
# Retain any previous successful export until the fresh artifact is validated.
if [[ -e "$output" ]]; then
  mv "$output" "$stage/previous"
fi
mv "$artifact" "$output"
printf '微信小游戏目录：%s\n' "$output"
