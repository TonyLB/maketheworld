import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { proposeRelationalTuples } from './proposeRelationalTuples'
import type { ObjectSpanCandidate, SpanCandidatePool } from './spanResolution'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId

const spanCandidate = (
    id: EphemeraObjectId,
    label: string,
    jointRelevance: number
): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance,
    sourceTags: ['lexical', 'embedding'],
    locus: { kind: 'room' },
})

const pool = (
    span: string,
    candidates: ObjectSpanCandidate[]
): SpanCandidatePool => ({
    span,
    candidates,
})

describe('proposeRelationalTuples', () => {
    it('builds cartesian product with min confidence', () => {
        const tuples = proposeRelationalTuples({
            subjectPool: pool('tool', [
                spanCandidate(broomId, 'broom', 0.7),
                spanCandidate(mopId, 'mop', 0.5),
            ]),
            targetPool: pool('table', [spanCandidate(tableId, 'table', 0.9)]),
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
        })

        expect(tuples).toHaveLength(2)
        expect(tuples[0]).toMatchObject({
            subject: { objectId: broomId },
            target: { objectId: tableId },
            confidence: 0.7,
            plan: { operationKind: 'establishRelation', relation: { type: 'enum', kind: 'On' } },
        })
        expect(tuples[1]).toMatchObject({
            subject: { objectId: mopId },
            target: { objectId: tableId },
            confidence: 0.5,
        })
    })

    it('skips same-id subject/target pairs', () => {
        const tuples = proposeRelationalTuples({
            subjectPool: pool('broom', [spanCandidate(broomId, 'broom', 1)]),
            targetPool: pool('broom', [spanCandidate(broomId, 'broom', 1)]),
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
        })
        expect(tuples).toEqual([])
    })

    it('prefers shortlist over full candidates', () => {
        const tuples = proposeRelationalTuples({
            subjectPool: {
                span: 'tool',
                candidates: [
                    spanCandidate(broomId, 'broom', 0.8),
                    spanCandidate(mopId, 'mop', 0.7),
                ],
                shortlist: [spanCandidate(broomId, 'broom', 0.8)],
            },
            targetPool: pool('table', [spanCandidate(tableId, 'table', 0.9)]),
            operationKind: 'establishRelation',
            relation: { type: 'enum', kind: 'On' },
        })
        expect(tuples).toHaveLength(1)
        expect(tuples[0]!.subject.objectId).toBe(broomId)
    })
})
