export type Drop<TMaterialId extends string | number> = {
  materialId: TMaterialId;
  amount: number;
};

/**
 * MVP: for a successful match, drop 1 unit of the same material.
 */
export function dropForMatch<TMaterialId extends string | number>(materialId: TMaterialId): Drop<TMaterialId>[] {
  return [{ materialId, amount: 1 }];
}

