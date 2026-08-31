import { normalizeExitName } from '../../roomExitTargetsForCharacter'

import type { PeerRelationalEdgeKind, NormalizeRelationOutcome, NormalizedRelation } from './relationKind'

const CONTAINMENT_PHRASES = ['in', 'inside', 'into'] as const
/** `On` joined containment's defer treatment 2026-08-22 (Channel D, CD2, reduced scope): AB-54
 * makes `On` a hosting kind, same as `In`/`PartOf`, and the current relation model has no
 * representation for hosting/containment at all --- so it defers rather than resolving to an
 * enum, exactly as `In`/`PartOf` already do. */
const ON_DEFER_PHRASES = ['on top of', 'onto', 'on'] as const

const ENUM_PHRASE_MAP: readonly { phrase: string; kind: Exclude<PeerRelationalEdgeKind, 'Custom'> }[] = [
    { phrase: 'leaning against', kind: 'Against' },
    { phrase: 'lean against', kind: 'Against' },
    { phrase: 'against', kind: 'Against' },
    { phrase: 'underneath', kind: 'Under' },
    { phrase: 'beneath', kind: 'Under' },
    { phrase: 'under', kind: 'Under' },
]

const matchesPhrase = (normalizedSpan: string, phrase: string): boolean => (
    normalizedSpan === phrase || new RegExp(`\\b${phrase}\\b`).test(normalizedSpan)
)

/** PV1-2: which containment kind a nesting-defer span names, if any --- `On` for the on-phrases, `In` for the containment phrases. */
function nestingDeferKind(normalizedSpan: string): 'On' | 'In' | undefined {
    if (ON_DEFER_PHRASES.some((phrase) => matchesPhrase(normalizedSpan, phrase))) {
        return 'On'
    }
    if (CONTAINMENT_PHRASES.some((phrase) => matchesPhrase(normalizedSpan, phrase))) {
        return 'In'
    }
    return undefined
}

function matchEnumKind(normalizedSpan: string): Exclude<PeerRelationalEdgeKind, 'Custom'> | undefined {
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

    const deferKind = nestingDeferKind(normalizedSpan)
    if (deferKind) {
        return { type: 'nestingDefer', kind: deferKind }
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
