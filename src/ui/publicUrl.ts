/**
 * 拼接 public 资源路径，必须走 BASE_URL，兼容 GitHub Pages base=./
 */
export function publicUrl(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${p}`;
}

