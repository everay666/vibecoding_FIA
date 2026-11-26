# 遗迹回声 / Echoes of the Buried Relic

浏览器第三人称 3D 游戏。键鼠：WASD／方向键移动，按住鼠标左键或右键拖动镜头，Shift 跑步，Space 跳跃，靠近宝物按 E 挖掘／开盒，Esc 暂停。目标是收集 3 个宝物并抵达出口。

## 操作速查

| 操作 | 键鼠输入 |
|---|---|
| 移动 | WASD 或方向键 |
| 调整镜头 | 在画布上按住鼠标左键或右键拖动 |
| 跑步 / 跳跃 | 按住 Shift / 按 Space |
| 挖掘、开盒 | 靠近宝物，在交互提示出现时按 E |
| 暂停 / 继续 | 人工模式按 Esc，或使用暂停 / 继续按钮 |
| 重新开始 | 暂停菜单或结果界面的“重新开始”按钮 |
| 声音 | 开始菜单中的音量滑块和扬声器按钮 |

先等待资源加载完成，再点击“开始游戏”。目标是收集 3 个宝物并抵达出口；HUD 显示收集进度和生命值。切换窗口或标签页可能触发暂停，回来后请检查暂停菜单。音效使用 Web Audio 合成，需要点击开始等用户操作解锁；不要把尚未交互时没有声音误判为音频资源丢失。

### 最终版本的手动试玩清单

以下是**待执行的检查步骤，不是已通过的测试记录**。每位成员应在无需 GitHub 登录的浏览器中打开最终共享站点，并在私人作业报告中如实记录结果和问题：

- 确认模型、场景和开始按钮加载完成；若按钮持续加载或报错，先查看浏览器 Console / Network，不要宣称已通过。
- 开始人工游戏，检查移动、镜头、跑步、跳跃及暂停 / 继续。
- 根据交互提示挖掘、开盒，检查收集进度；检查收集完成后出口及通关流程。
- 从暂停菜单或结果界面重新开始，确认进度和生命值回到初始状态。
- 检查角色与环境素材、音效、音量和静音；说明浏览器或网络限制。
- 对照最终团队 `main` commit 和对应部署记录，确认检查的是最终版本。若合并修复改变版本，更新私人记录并重新检查受影响项目。

操作依据：[`input.js`](./input.js)、[`main.js`](./main.js)、[`index.html`](./index.html) 和 [`audio.js`](./audio.js)。此操作说明和清单由 AI 辅助整理并对照源码作静态核验；不代表成员本人完成试玩、互查或最终批准。

## 在线游玩

GitHub Pages 发布完成后填写：https://everay666.github.io/vibecoding_FIA/

## 本地运行

通过 HTTP 服务器打开根目录 `index.html`，不要直接双击使用 `file://`。需要支持 WebGL 和 import map 的现代浏览器，并能联网访问 jsDelivr 上的 Three.js 0.170.0。

当前仓库没有 `package.json` 或 `pnpm-lock.yaml`，因此不能在此版本直接执行 `pnpm install --frozen-lockfile` / `pnpm start`。如果已安装 Python 3，可在仓库根目录运行：

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Windows 也可使用 `py -3 -m http.server 5173 --bind 127.0.0.1`。打开 <http://127.0.0.1:5173/>，结束时在终端按 Ctrl+C。服务器启动只表示静态文件可访问，不代表游戏能正常运行；还需检查下面的资源路径问题。

### 素材路径与启动排障

当前版本存在以下目录／引用不一致，需由团队修复后再验证可游玩性：

| 代码请求的路径 | 当前仓库中的文件位置 |
| --- | --- |
| `src/main.js`（`index.html` 的模块入口） | 根目录 `main.js` |
| `assets/explorer.glb`（`player.js`） | 根目录 `explorer.glb` |
| `assets/ruins-environment.glb`（`scene.js`） | 根目录 `ruins-environment.glb` |
| `assets/ruins-treasure-colliders.glb`（`scene.js`） | 根目录 `ruins-treasure-colliders.glb` |
| `assets/level-manifest.json`（`asset-level.js`） | 根目录 `level-manifest.json` |

排查顺序：

1. 打开浏览器开发者工具的 Network 和 Console，刷新页面；先检查入口模块是否返回 404，再检查 GLB／JSON 请求。入口未加载时，后续素材请求可能尚未发出。
2. 若目录结构保持现状，应由团队统一调整引用；若恢复 `src/` 和 `assets/`，则应保留模块之间的相对导入关系并上传全部必要文件。不要只改入口后就认定所有资源已经修复。
3. 若 jsDelivr 请求失败，先确认网络可访问 `index.html` 中的 CDN 地址；本仓库目前不是完整离线包。
4. 资源请求通过后，仍需人工检查开始、移动、收集、重新开始及声音／静音；本节不作为任何成员已完成这些检查的证明。

## 发布

GitHub 仓库 Settings → Pages → Deploy from a branch → `main` → `/(root)`。源码所需文件为 `index.html`、`style.css`、`src/` 和 `assets/`。

## CI/CD note
我们检查了开启 GitHub Pages 时自动触发的首次部署工作流。
本次部署由 push 到 main 分支自动触发，无需手动干预。在 Actions 页面中，可以看到工作流按顺序执行了 Checkout（拉取代码）、Setup Pages（配置环境）和 Deploy to GitHub Pages（发布）等步骤，最终执行成功（显示绿色对勾）。如果不想折腾环境变量，可以试试用 Python 自带的 HTTP 服务器（前提是电脑装了 Python）。在项目目录下运行 python -m http.server 5173，也能达到临时预览的效果。
在整个部署流程中，没有任何自动化测试、代码规范检查或语法检查。只要代码推送到仓库，GitHub 就会直接将其作为静态文件发布

## 已知限制与素材

浏览器／网络需支持 WebGL 并能访问 jsDelivr；。素材均由ai生成，Three.js 版本为 0.170.0。

## Creators

Chen, Lin, Liu, Weng and Yi. (The rank is in no particular order. )
