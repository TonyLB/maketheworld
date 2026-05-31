import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import type { PersistedReferencedByEntry } from '../componentData/referencedBy'

const isAreaUniversalKey = (value: string): value is ComponentUUID =>
    value.startsWith('AREA#')

/**
 * v1 topology consumer (D14): AREA# referrers where the room is an edge endpoint (Edge referenceType).
 */
export function filterAreaEdgeReferrers(
    referencedByUnion: readonly PersistedReferencedByEntry[] | undefined
): ComponentUUID[] {
    if (!referencedByUnion?.length) {
        return []
    }
    const seen = new Set<string>()
    const result: ComponentUUID[] = []
    for (const entry of referencedByUnion) {
        if (!isAreaUniversalKey(entry.referrerUniversalKey)) {
            continue
        }
        if (entry.referenceType !== undefined && entry.referenceType !== 'Edge') {
            continue
        }
        if (seen.has(entry.referrerUniversalKey)) {
            continue
        }
        seen.add(entry.referrerUniversalKey)
        result.push(entry.referrerUniversalKey)
    }
    return result
}
