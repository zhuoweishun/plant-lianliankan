type ParallaxOptions = {
  strengthPx: number;
};

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const raf: (cb: FrameRequestCallback) => number =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame.bind(globalThis)
    : ((cb: FrameRequestCallback) => globalThis.setTimeout(() => cb(Date.now()), 0)) as unknown as (
        cb: FrameRequestCallback,
      ) => number;

const caf: (id: number) => void =
  typeof cancelAnimationFrame === "function"
    ? cancelAnimationFrame.bind(globalThis)
    : ((id: number) => globalThis.clearTimeout(id)) as unknown as (id: number) => void;

/**
 * 给容器写入多组 CSS 变量（--px1/--py1/...），供不同深度的层做 translate 视差。
 * - 使用 requestAnimationFrame 节流
 * - prefers-reduced-motion 自动禁用
 */
export function attachParallax(el: HTMLElement, options: ParallaxOptions): () => void {
  if (prefersReducedMotion()) return () => {};

  const strength = options.strengthPx;
  let frame = 0;
  let lastX = 0;
  let lastY = 0;

  const apply = () => {
    frame = 0;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    const nx = (lastX / w - 0.5) * 2; // -1..1
    const ny = (lastY / h - 0.5) * 2; // -1..1

    // 4 层深度：远->近
    const d1 = 0.15,
      d2 = 0.35,
      d3 = 0.6,
      d4 = 1.0;

    el.style.setProperty("--px1", `${nx * strength * d1}px`);
    el.style.setProperty("--py1", `${ny * strength * d1}px`);
    el.style.setProperty("--px2", `${nx * strength * d2}px`);
    el.style.setProperty("--py2", `${ny * strength * d2}px`);
    el.style.setProperty("--px3", `${nx * strength * d3}px`);
    el.style.setProperty("--py3", `${ny * strength * d3}px`);
    el.style.setProperty("--px4", `${nx * strength * d4}px`);
    el.style.setProperty("--py4", `${ny * strength * d4}px`);
  };

  const request = () => {
    if (!frame) frame = raf(apply);
  };

  const onMove = (e: PointerEvent) => {
    lastX = e.clientX;
    lastY = e.clientY;
    request();
  };

  const onLeave = () => {
    lastX = (el.clientWidth || 1) / 2;
    lastY = (el.clientHeight || 1) / 2;
    request();
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
  onLeave();

  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    if (frame) caf(frame);
  };
}
