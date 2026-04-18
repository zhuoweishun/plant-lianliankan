export type StickerId = "wood" | "stone" | "water" | "leaf" | "bench" | "pond" | "tree";

const cache = new Map<StickerId, HTMLImageElement>();

/**
 * Public 资源路径。必须使用 BASE_URL 来兼容 GitHub Pages 的 base=./ 配置。
 */
export function stickerUrl(id: StickerId): string {
  return `${import.meta.env.BASE_URL}ui/stickers/${id}.png`;
}

export function getStickerImage(id: StickerId): HTMLImageElement | undefined {
  return cache.get(id);
}

/**
 * 预加载贴纸，供 Canvas 渲染使用（避免 draw 时频繁创建 Image）。
 * 加载失败会静默降级（保持可玩）。
 */
export function preloadStickers(ids: readonly StickerId[]): Promise<void> {
  const unique = Array.from(new Set(ids));
  const tasks = unique.map(
    (id) =>
      new Promise<void>((resolve) => {
        if (cache.has(id)) return resolve();
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = stickerUrl(id);
        cache.set(id, img);
      }),
  );
  return Promise.all(tasks).then(() => undefined);
}

