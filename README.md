# 遗迹回声 / Echoes of the Buried Relic

浏览器第三人称 3D 游戏。键鼠：WASD／方向键移动，按住鼠标左键或右键拖动镜头，Shift 跑步，Space 跳跃，靠近宝物按 E 挖掘／开盒，Esc 暂停。目标是收集 3 个宝物并抵达出口。

## 在线游玩

GitHub Pages 发布完成后填写：https://everay666.github.io/vibecoding_FIA/

## 本地运行

通过 HTTP 服务器打开根目录 `index.html`（不要直接双击）。Three.js 使用 jsDelivr CDN，需联网。若在本目录本机已有 Node.js 与 pnpm：`pnpm install --frozen-lockfile`，然后 `pnpm start`，访问 `http://localhost:5173/`。

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
