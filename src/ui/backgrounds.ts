import { publicUrl } from "./publicUrl.ts";

export type SceneKind = "garden" | "match";

type LayerName = "base";

const BG: Record<SceneKind, Record<LayerName, string>> = {
  garden: {
    base: "ui/backgrounds/garden/base.jpg",
  },
  match: {
    base: "ui/backgrounds/match/base.jpg",
  },
};

export function applySceneBackgrounds(sceneEl: HTMLElement, kind: SceneKind): void {
  const def = BG[kind];
  const base = sceneEl.querySelector<HTMLDivElement>(".bg-layer--base");
  if (base) base.style.backgroundImage = `url("${publicUrl(def.base)}")`;
}

