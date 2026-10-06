import { normalizeExitName } from '../../roomExitTargetsForCharacter'

import type { PeerRelationalEdgeKind, NormalizedRelation } from './relationKind'

const ENUM_PHRASE_MAP: readonly { phrase: string; kind: Exclude<PeerRelationalEdgeKind, 'Custom'> }[] = [
    { phrase: 'leaning against', kind: 'Against' },
    { phrase: 'lean against', kind: 'Against' },
    { phrase: 'against', kind: 'Against' },
    { phrase: 'underneath', kind: 'Under' },
    { phrase: 'beneath', kind: 'Under' },
    { phrase: 'under', kind: 'Under' },
]

function matchEnumKind(normalizedSpan: string): Exclude<PeerRelationalEdgeKind, 'Custom'> | undefined {
    for (const { phrase, kind } of ENUM_PHRASE_MAP) {
        if (normalizedSpan === phrase) {
            return kind
        }
    }
    return undefined
}

/**
 * Peer half of a preposition span. Containment phrases (`in`, `on`, ...) are not classified here:
 * the containment template claims them, and the relational template answers `noMatch` for them
 * before it asks this function.
 */
export function normalizeRelationSpan(relationSpan: string): NormalizedRelation {
    const trimmedSpan = relationSpan.trim()
    const normalizedSpan = normalizeExitName(trimmedSpan)

    if (!normalizedSpan) {
        return {
            type: 'custom',
            kind: 'Custom',
            relationLabel: trimmedSpan,
        }
    }

    const enumKind = matchEnumKind(normalizedSpan)
    if (enumKind) {
        return { type: 'enum', kind: enumKind }
    }

    return {
        type: 'custom',
        kind: 'Custom',
        relationLabel: trimmedSpan,
    }
}
