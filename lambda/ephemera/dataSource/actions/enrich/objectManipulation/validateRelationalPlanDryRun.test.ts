import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
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

const onTableEdge: EphemeraLudicRelationalEdgeData = {
    tag: 'Relational',
    from: broomId,
    to: tableId,
    kind: 'Under',
}

describe('validateRelationalPlanDryRun', () => {
    it('maps allow -> legal', () => {
        const candidate = relationalIdentityPlanCandidateFromSpans(
            span(broomId, 'broom'),
            span(tableId, 'table'),
            'establishRelation',
            { type: 'enum', kind: 'Under' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            ludicGraph: testLudicGraph(roomId, {
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
            { type: 'enum', kind: 'Under' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            ludicGraph: testLudicGraph(roomId, { nodes: [] }),
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
            { type: 'enum', kind: 'Under' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            ludicGraph: testLudicGraph(roomId, {
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
            { type: 'enum', kind: 'Against' }
        )
        expect(validateRelationalPlanDryRun(candidate, {
            ludicGraph: testLudicGraph(roomId, {
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
