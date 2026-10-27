/**
 * Leaf module: kept free of `internalCache` imports so the span-embedding handler can use it
 * without an import cycle.
 */
export const normalizeExitName = (name: string): string => (
    name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
)
