import { acKind } from './ac';
import { genericKind } from './generic';
import { radiatorKind } from './radiator';
import type { SystemKindSpec } from './types';

export type { MessageKind, SystemKindSpec } from './types';
export { acKind, genericKind, radiatorKind };

const SPECS: ReadonlyMap<string, SystemKindSpec> = new Map([
  [radiatorKind.kind, radiatorKind],
  [acKind.kind, acKind],
]);

/** Spec of a kind; unknown kinds get the generic one. */
export function kindSpec(kind: string): SystemKindSpec {
  return SPECS.get(kind) ?? genericKind;
}

/** Stable sort by lane order (radiator, ac, others), keeping the input order within a kind group. */
export function sortByLaneOrder<T extends { kind: string }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, order: kindSpec(item.kind).laneOrder }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((x) => x.item);
}
