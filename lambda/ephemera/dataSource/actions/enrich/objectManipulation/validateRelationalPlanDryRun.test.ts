import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testPositionGraph } from '../../../positions/positionGraph/testFixtures'
import { relationalIdentityPlanCandidateFromSpans } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ObjectSpanCandidate } from './spanResolution'
import { validateRelationalPlanDryRun } from './validatePlanDryRun'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

const span = (
    id: EphemeraObjectId,
    label: string
): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance: 1,
    sourceTags: ['exact'],
    locus: { kind: 'room' },
})

const onTableEdge: EphemeraPositionRelationalEdgeData = {
    tag: 'Relational',
    from: broomId,
    to: tableId,
    kind: 'On',
}

describe('validateRelationalPlanDryRun', () => {
    it('maps allow -> legal', () => {
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(broomId, 'broom'),
            span(tableId, 'table'),
            'establishRelation',
            { type: 'enum', kind: 'On' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            positionGraph: testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
            }),
        })).toEqual({ verdict: 'legal', decidable: true })
    })

    it('maps not-on-graph -> illegal', () => {
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(broomId, 'broom'),
            span(tableId, 'table'),
            'establishRelation',
            { type: 'enum', kind: 'On' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            positionGraph: testPositionGraph(roomId, { nodes: [] }),
        })).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.notOnHostGraph,
        })
    })

    it('maps dissolve miss -> illegal', () => {
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(broomId, 'broom'),
            span(tableId, 'table'),
            'dissolveRelation',
            { type: 'enum', kind: 'On' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            positionGraph: testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
            }),
        })).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.dissolveNoMatchingEdge,
        })
    })

    it('maps complex topology -> illegal', () => {
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(broomId, 'broom'),
            span(tableId, 'table'),
            'establishRelation',
            { type: 'enum', kind: 'Under' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            positionGraph: testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
                edges: [onTableEdge],
            }),
        })).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.complexRelational,
        })
    })
})
