import type {
    EphemeraCharacterId,
    EphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraCharacterId,
    isEphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogScope } from './catalogMerge'
import type { EphemeraThingId } from './thing'
import { isEphemeraThingId } from './thing'

/**
 * FT-4 span-resolution artifacts (FT-0 skeleton).
 * Input pool (evidence) and selector verdict are separate types; no runtime wiring yet.
 */

export type SpanCandidateLocus =
    | { kind: 'room' }
    | { kind: 'heldByActor' }
    | { kind: 'heldByOtherCharacter'; characterId: EphemeraCharacterId; characterLabel: string }
    | { kind: 'withinObject'; hostId: EphemeraObjectId; hostLabel: string }

export type SpanRelevanceSourceTag = 'exact' | 'lexical' | 'embedding' | 'llm'

export type ObjectSpanCandidate = {
    id: EphemeraThingId
    label: string
    /** Absolute joint relevance in [0, 1] after FT-8 normalization (FT-1). */
    jointRelevance: number
    marginToRunnerUp?: number
    /** Absent channel = undefined, not 0 (FT-1 / FT-8). */
    lexRelevance?: number
    embedRelevance?: number
    sourceTags: readonly SpanRelevanceSourceTag[]
    locus: SpanCandidateLocus
}

export type SpanCandidatePool = {
    span: string
    /** Empty array = nothing to rank; no separate status field (FT-4). */
    candidates: readonly ObjectSpanCandidate[]
    /** Gap-trim shortlist (FT-1); optional until pool builder ships. */
    shortlist?: readonly ObjectSpanCandidate[]
}

export type SpanResolutionConsultAlternative = {
    objectId: EphemeraObjectId
    label: string
    proposedCommand: string
}

export type SpanResolutionOutcome =
    | { verdict: 'resolved'; objectId: EphemeraObjectId; locus: SpanCandidateLocus }
    | { verdict: 'consult'; alternatives: readonly SpanResolutionConsultAlternative[] }
    | { verdict: 'error'; reason: string }

const SPAN_RELEVANCE_SOURCE_TAGS: ReadonlySet<SpanRelevanceSourceTag> = new Set([
    'exact',
    'lexical',
    'embedding',
    'llm',
])

const isUnitInterval = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
)

export function catalogScopeToLocus(scope: ObjectManipulationCatalogScope): SpanCandidateLocus {
    return scope === 'held' ? { kind: 'heldByActor' } : { kind: 'room' }
}

export function isSpanCandidateLocus(value: unknown): value is SpanCandidateLocus {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const record = value as Record<string, unknown>
    const kind = record.kind
    if (kind === 'room' || kind === 'heldByActor') {
        return true
    }
    if (kind === 'heldByOtherCharacter') {
        return (
            typeof record.characterLabel === 'string'
            && record.characterLabel.trim().length > 0
            && typeof record.characterId === 'string'
            && isEphemeraCharacterId(record.characterId)
        )
    }
    if (kind === 'withinObject') {
        return (
            typeof record.hostLabel === 'string'
            && record.hostLabel.trim().length > 0
            && typeof record.hostId === 'string'
            && isEphemeraObjectId(record.hostId)
        )
    }
    return false
}

export function isObjectSpanCandidate(value: unknown): value is ObjectSpanCandidate {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const record = value as Record<string, unknown>
    if (typeof record.id !== 'string' || !isEphemeraThingId(record.id)) {
        return false
    }
    if (typeof record.label !== 'string' || record.label.trim().length === 0) {
        return false
    }
    if (!isUnitInterval(record.jointRelevance)) {
        return false
    }
    if (
        record.marginToRunnerUp !== undefined
        && !isUnitInterval(record.marginToRunnerUp)
    ) {
        return false
    }
    if (
        record.lexRelevance !== undefined
        && !isUnitInterval(record.lexRelevance)
    ) {
        return false
    }
    if (
        record.embedRelevance !== undefined
        && !isUnitInterval(record.embedRelevance)
    ) {
        return false
    }
    if (!Array.isArray(record.sourceTags) || record.sourceTags.length === 0) {
        return false
    }
    if (!record.sourceTags.every((tag) => SPAN_RELEVANCE_SOURCE_TAGS.has(tag as SpanRelevanceSourceTag))) {
        return false
    }
    return isSpanCandidateLocus(record.locus)
}

export function isSpanCandidatePool(value: unknown): value is SpanCandidatePool {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const record = value as Record<string, unknown>
    if (typeof record.span !== 'string') {
        return false
    }
    if (!Array.isArray(record.candidates)) {
        return false
    }
    if (!record.candidates.every((candidate) => isObjectSpanCandidate(candidate))) {
        return false
    }
    if (record.shortlist !== undefined) {
        if (!Array.isArray(record.shortlist)) {
            return false
        }
        if (!record.shortlist.every((candidate) => isObjectSpanCandidate(candidate))) {
            return false
        }
    }
    return true
}

export function isSpanResolutionOutcome(value: unknown): value is SpanResolutionOutcome {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }
    const record = value as Record<string, unknown>
    const verdict = record.verdict
    if (verdict === 'resolved') {
        return (
            typeof record.objectId === 'string'
            && isEphemeraObjectId(record.objectId)
            && isSpanCandidateLocus(record.locus)
        )
    }
    if (verdict === 'consult') {
        if (!Array.isArray(record.alternatives) || record.alternatives.length === 0) {
            return false
        }
        return record.alternatives.every((alternative) => {
            if (!alternative || typeof alternative !== 'object' || Array.isArray(alternative)) {
                return false
            }
            const alt = alternative as Record<string, unknown>
            return (
                typeof alt.objectId === 'string'
                && isEphemeraObjectId(alt.objectId)
                && typeof alt.label === 'string'
                && alt.label.trim().length > 0
                && typeof alt.proposedCommand === 'string'
                && alt.proposedCommand.trim().length > 0
            )
        })
    }
    if (verdict === 'error') {
        return typeof record.reason === 'string' && record.reason.trim().length > 0
    }
    return false
}
