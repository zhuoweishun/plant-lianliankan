# 植物小园：连连采集（MVP）

这是一个 **Web 可预览（HTML5）→ 后续 Electron 打包上 Steam** 的项目。当前目标是先把闭环做出来：**连连看采集 → 回花园结算 → 花园摆放 → 刷新仍在**。

## 本地/开发（给 SOlO 或 CI 用）

```bash
npm install
npm run dev
```

## 运行测试（护栏）

```bash
npm test
npm run typecheck
```

## 部署到 GitHub Pages（用于平板线上验收）

本仓库已包含工作流：`.github/workflows/pages.yml`。

1. 把代码推到 GitHub（默认分支 `main`）。
2. 打开 GitHub 仓库 → **Settings → Pages**：
   - Source 选择 **GitHub Actions**
3. 等待 Actions 跑完后，会生成一个 Pages URL：
   - `https://<你的用户名>.github.io/<仓库名>/`

> 说明：`vite.config.ts` 使用 `base: "./"`，避免因为仓库名不同导致资源路径出错。

