import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import {
    groundMembershipCandidate,
    planMembershipDesiredResult,
    proposeMembershipCandidates,
} from './proposeMembershipCandidates'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import type { SpanCandidateLocus, SpanCandidatePool } from './spanResolution'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const otherId = 'OBJECT#Other' as EphemeraObjectId
const ropeId = 'OBJECT#Rope' as EphemeraObjectId

describe('proposeMembershipCandidates', () => {
    const pool: SpanCandidatePool = {
        span: 'bag',
        candidates: [
            {
                id: bagId,
                label: 'bag',
                jointRelevance: 0.7,
                sourceTags: ['lexical'],
                locus: { kind: 'room' },
            },
            {
                id: satchelId,
                label: 'satchel',
                jointRelevance: 0.65,
                sourceTags: ['lexical'],
                locus: { kind: 'heldByActor' },
            },
            {
                id: otherId,
                label: 'chest',
                jointRelevance: 0.2,
                sourceTags: ['embedding'],
                locus: {
                    kind: 'withinObject',
                    hostId: bagId,
                    hostLabel: 'bag',
                },
            },
        ],
    }

    it('applies verb-derived operationKind to all v1-locus candidates', () => {
        const tuples = proposeMembershipCandidates({ pool, verbClass: 'release' })
        expect(tuples).toHaveLength(2)
        expect(tuples.every((t) => t.plan.operationKind === 'drop')).toBe(true)
        expect(tuples.map((t) => t.identity.objectId)).toEqual([bagId, satchelId])
    })

    it('prefers shortlist when present', () => {
        const withShortlist: SpanCandidatePool = {
            ...pool,
            shortlist: [pool.candidates[1]!],
        }
        const tuples = proposeMembershipCandidates({ pool: withShortlist, verbClass: 'release' })
        expect(tuples).toHaveLength(1)
        expect(tuples[0]!.identity.objectId).toBe(satchelId)
    })

    it('returns empty for empty pool', () => {
        expect(proposeMembershipCandidates({
            pool: { span: 'x', candidates: [] },
            verbClass: 'acquire',
        })).toEqual([])
    })
})

describe('groundMembershipCandidate', () => {
    const catalog: ObjectManipulationCatalogEntry[] = [
        { objectId: ropeId, normalizedShortName: 'rope', catalogScope: 'room', gloss: 'a coil of hemp rope' },
    ]

    const candidate = (
        objectId: EphemeraObjectId,
        locus: SpanCandidateLocus,
        operationKind: 'takeHold' | 'drop'
    ): IdentityPlanCandidate => ({
        identity: { objectId, label: objectId, locus, jointRelevance: 0.8, sourceTags: ['exact'] },
        plan: { kind: 'transferMembership', operationKind },
        confidence: 0.8,
    })

    it('builds one un-expanded attempt per tuple, its primary action wrapping the wholly ungrounded desired result (AP-10: grounding defers to the dry run)', () => {
        const context = { words: 'take the rope', span: 'rope', catalog }
        const grounded = groundMembershipCandidate(candidate(ropeId, { kind: 'room' }, 'takeHold'), context)

        const planned = planMembershipDesiredResult('takeHold', 'rope')
        expect(grounded.desiredResult).toEqual(planned)
        expect(grounded.attempt.toJSON().actions).toEqual([
            expect.objectContaining({ desiredResult: grounded.desiredResult }),
        ])
        expect(grounded.attempt.words).toBe('take the rope')
    })

    it('grounds the referent from the catalog, gloss included', () => {
        const grounded = groundMembershipCandidate(candidate(ropeId, { kind: 'room' }, 'takeHold'), { words: 'take the rope', span: 'rope', catalog })

        expect(grounded.attempt.referents()).toEqual([
            { refKey: 'primaryObject', id: ropeId, shortName: 'rope', gloss: 'a coil of hemp rope' },
        ])
    })

    it('falls back to the span text when the catalog has no entry', () => {
        const grounded = groundMembershipCandidate(candidate(otherId, { kind: 'room' }, 'takeHold'), { words: 'take the chest', span: 'chest', catalog })

        expect(grounded.attempt.referents()).toEqual([
            { refKey: 'primaryObject', id: otherId, shortName: 'chest' },
        ])
    })
})
