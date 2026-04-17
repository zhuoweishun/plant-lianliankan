import { defineConfig } from "vite";

// GitHub Pages 会把站点部署在 /<repo>/ 子路径下。
// 这里使用相对路径（./）让资源引用对任意子路径都能工作，
// 从而避免每次改 repo 名都要改配置。
export default defineConfig({
  base: "./",
});

