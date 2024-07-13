import { excludeUndefined } from "../lib/lists";
import { StandardComponent, StandardNodeKeys } from "./baseClasses";

export const combineTagChildren = <T extends StandardComponent, K extends StandardNodeKeys<T>>(base: T, incoming: T, key: K): T[K] => (
    excludeUndefined(base[key])
        ? excludeUndefined(incoming[key])
            ? { ...base[key], id: (base[key] as any).id || (incoming[key] as any).id, children: [...(base[key] as any).children, ...(incoming[key] as any).children] }
            : base[key]
        : incoming[key]
)
