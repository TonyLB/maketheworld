import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { proposeMembershipTuples } from './proposeMembershipTuples'
import type { SpanCandidatePool } from './spanResolution'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const otherId = 'OBJECT#Other' as EphemeraObjectId

describe('proposeMembershipTuples', () => {
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
        const tuples = proposeMembershipTuples({ pool, verbClass: 'release' })
        expect(tuples).toHaveLength(2)
        expect(tuples.every((t) => t.plan.operationKind === 'drop')).toBe(true)
        expect(tuples.map((t) => t.identity.objectId)).toEqual([bagId, satchelId])
    })

    it('uses locus-derived operationKind when verbClass absent', () => {
        const tuples = proposeMembershipTuples({ pool })
        expect(tuples).toEqual([
            expect.objectContaining({
                identity: expect.objectContaining({ objectId: bagId }),
                plan: { kind: 'transferMembership', operationKind: 'takeHold' },
                confidence: 0.7,
            }),
            expect.objectContaining({
                identity: expect.objectContaining({ objectId: satchelId }),
                plan: { kind: 'transferMembership', operationKind: 'drop' },
                confidence: 0.65,
            }),
        ])
    })

    it('prefers shortlist when present', () => {
        const withShortlist: SpanCandidatePool = {
            ...pool,
            shortlist: [pool.candidates[1]!],
        }
        const tuples = proposeMembershipTuples({ pool: withShortlist, verbClass: 'release' })
        expect(tuples).toHaveLength(1)
        expect(tuples[0]!.identity.objectId).toBe(satchelId)
    })

    it('returns empty for empty pool', () => {
        expect(proposeMembershipTuples({
            pool: { span: 'x', candidates: [] },
            verbClass: 'acquire',
        })).toEqual([])
    })
})
