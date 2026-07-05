import { normalizeExitName } from '../../roomExitTargetsForCharacter'

import type { HostRelationalEdgeKind, NormalizeRelationOutcome, NormalizedRelation } from './relationKind'

const CONTAINMENT_PHRASES = ['in', 'inside', 'into'] as const

const ENUM_PHRASE_MAP: readonly { phrase: string; kind: Exclude<HostRelationalEdgeKind, 'Custom'> }[] = [
    { phrase: 'leaning against', kind: 'Against' },
    { phrase: 'lean against', kind: 'Against' },
    { phrase: 'against', kind: 'Against' },
    { phrase: 'underneath', kind: 'Under' },
    { phrase: 'beneath', kind: 'Under' },
    { phrase: 'under', kind: 'Under' },
    { phrase: 'on top of', kind: 'On' },
    { phrase: 'onto', kind: 'On' },
    { phrase: 'on', kind: 'On' },
]

function isContainmentSpan(normalizedSpan: string): boolean {
    if (CONTAINMENT_PHRASES.includes(normalizedSpan as typeof CONTAINMENT_PHRASES[number])) {
        return true
    }
    return CONTAINMENT_PHRASES.some((phrase) => (
        normalizedSpan === phrase
        || new RegExp(`\\b${phrase}\\b`).test(normalizedSpan)
    ))
}

function matchEnumKind(normalizedSpan: string): Exclude<HostRelationalEdgeKind, 'Custom'> | undefined {
    for (const { phrase, kind } of ENUM_PHRASE_MAP) {
        if (normalizedSpan === phrase) {
            return kind
        }
    }
    return undefined
}

export function normalizeRelationSpan(relationSpan: string): NormalizeRelationOutcome {
    const trimmedSpan = relationSpan.trim()
    const normalizedSpan = normalizeExitName(trimmedSpan)

    if (!normalizedSpan) {
        return {
            type: 'success',
            relation: {
                type: 'custom',
                kind: 'Custom',
                relationLabel: trimmedSpan,
            },
        }
    }

    if (isContainmentSpan(normalizedSpan)) {
        return { type: 'nestingDefer' }
    }

    const enumKind = matchEnumKind(normalizedSpan)
    if (enumKind) {
        return {
            type: 'success',
            relation: { type: 'enum', kind: enumKind },
        }
    }

    const customRelation: NormalizedRelation = {
        type: 'custom',
        kind: 'Custom',
        relationLabel: trimmedSpan,
    }
    return { type: 'success', relation: customRelation }
}
