export type DecorationId = "bench" | "pond" | "tree";

export type DecorationDef = {
  id: DecorationId;
  name: string;
  w: number;
  h: number;
  color: string;
};

export const DECORATIONS: readonly DecorationDef[] = [
  { id: "bench", name: "长椅", w: 2, h: 1, color: "#8d6e63" },
  { id: "pond", name: "池塘", w: 2, h: 2, color: "#4fc3f7" },
  { id: "tree", name: "小树", w: 1, h: 2, color: "#81c784" },
] as const;

const byId = new Map<DecorationId, DecorationDef>(DECORATIONS.map((d) => [d.id, d]));

export function getDecoration(id: DecorationId): DecorationDef {
  const d = byId.get(id);
  if (!d) throw new Error(`Unknown decoration id: ${id}`);
  return d;
}

