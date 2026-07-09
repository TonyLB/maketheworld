import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    catalogScopeToLocus,
    isObjectSpanCandidate,
    isSpanCandidateLocus,
    isSpanCandidatePool,
    isSpanResolutionOutcome,
    type ObjectSpanCandidate,
    type SpanCandidatePool,
    type SpanResolutionOutcome,
} from './spanResolution'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId
const boxId = 'OBJECT#Box' as EphemeraObjectId
const characterId = 'CHARACTER#Alice' as EphemeraCharacterId

const roomCandidate: ObjectSpanCandidate = {
    id: broomId,
    label: 'broom',
    jointRelevance: 0.82,
    marginToRunnerUp: 0.12,
    lexRelevance: 0.9,
    embedRelevance: 0.65,
    sourceTags: ['lexical', 'embedding'],
    locus: { kind: 'room' },
}

describe('catalogScopeToLocus', () => {
    it('maps room catalog scope to room locus', () => {
        expect(catalogScopeToLocus('room')).toEqual({ kind: 'room' })
    })

    it('maps held catalog scope to heldByActor locus', () => {
        expect(catalogScopeToLocus('held')).toEqual({ kind: 'heldByActor' })
    })
})

describe('isSpanCandidateLocus', () => {
    it('accepts v1 cheap loci', () => {
        expect(isSpanCandidateLocus({ kind: 'room' })).toBe(true)
        expect(isSpanCandidateLocus({ kind: 'heldByActor' })).toBe(true)
    })

    it('accepts deferred locus variants', () => {
        expect(isSpanCandidateLocus({
            kind: 'heldByOtherCharacter',
            characterId,
            characterLabel: 'Bob',
        })).toBe(true)
        expect(isSpanCandidateLocus({
            kind: 'withinObject',
            hostId: boxId,
            hostLabel: 'wooden box',
        })).toBe(true)
    })

    it('rejects invalid locus shapes', () => {
        expect(isSpanCandidateLocus({ kind: 'unknown' })).toBe(false)
        expect(isSpanCandidateLocus({ kind: 'withinObject', hostId: 'bad', hostLabel: 'box' })).toBe(false)
    })
})

describe('isObjectSpanCandidate', () => {
    it('accepts a valid candidate', () => {
        expect(isObjectSpanCandidate(roomCandidate)).toBe(true)
    })

    it('accepts exact-match candidate with lexical channel only', () => {
        expect(isObjectSpanCandidate({
            id: broomId,
            label: 'broom',
            jointRelevance: 1,
            sourceTags: ['exact'],
            locus: { kind: 'room' },
        })).toBe(true)
    })

    it('rejects joint relevance outside [0, 1]', () => {
        expect(isObjectSpanCandidate({
            ...roomCandidate,
            jointRelevance: 1.5,
        })).toBe(false)
    })

    it('rejects empty source tags', () => {
        expect(isObjectSpanCandidate({
            ...roomCandidate,
            sourceTags: [],
        })).toBe(false)
    })
})

describe('isSpanCandidatePool', () => {
    const pool: SpanCandidatePool = {
        span: 'sweeping tool',
        candidates: [roomCandidate],
        shortlist: [roomCandidate],
    }

    it('accepts a valid pool with shortlist', () => {
        expect(isSpanCandidatePool(pool)).toBe(true)
    })

    it('accepts an empty candidate list', () => {
        expect(isSpanCandidatePool({
            span: 'sword',
            candidates: [],
        })).toBe(true)
    })

    it('rejects invalid shortlist entries', () => {
        expect(isSpanCandidatePool({
            span: 'broom',
            candidates: [roomCandidate],
            shortlist: [{ id: 'bad' }],
        })).toBe(false)
    })
})

describe('isSpanResolutionOutcome', () => {
    it('accepts resolved verdict', () => {
        const outcome: SpanResolutionOutcome = {
            verdict: 'resolved',
            objectId: broomId,
            locus: { kind: 'room' },
        }
        expect(isSpanResolutionOutcome(outcome)).toBe(true)
    })

    it('accepts consult verdict with alternatives', () => {
        const outcome: SpanResolutionOutcome = {
            verdict: 'consult',
            alternatives: [
                {
                    objectId: broomId,
                    label: 'broom',
                    proposedCommand: 'take the broom',
                },
                {
                    objectId: mopId,
                    label: 'mop',
                    proposedCommand: 'take the mop',
                },
            ],
        }
        expect(isSpanResolutionOutcome(outcome)).toBe(true)
    })

    it('accepts error verdict', () => {
        expect(isSpanResolutionOutcome({
            verdict: 'error',
            reason: 'identity invoke failed',
        })).toBe(true)
    })

    it('rejects consult with empty alternatives', () => {
        expect(isSpanResolutionOutcome({
            verdict: 'consult',
            alternatives: [],
        })).toBe(false)
    })

    it('rejects unknown verdict', () => {
        expect(isSpanResolutionOutcome({
            verdict: 'abstain',
            reason: 'unparseable',
        })).toBe(false)
    })
})
