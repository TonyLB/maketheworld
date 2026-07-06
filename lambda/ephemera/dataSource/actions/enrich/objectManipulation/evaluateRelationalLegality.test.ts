import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { EphemeraPositionGraph } from '../../../positions/positionGraph'
import { evaluateRelationalLegality } from './evaluateRelationalLegality'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const HOST_ID = 'ROOM#Bridge' as EphemeraRoomId

const roomGraphWithObjects = {
    nodes: [
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: tableId },
    ],
    edges: [],
} as unknown as PlayPositionGraph

const onTableEdge: EphemeraPositionRelationalEdgeData = {
    tag: 'Relational',
    from: broomId,
    to: tableId,
    kind: 'On',
}

const graphFromEnvelope = (envelope: PlayPositionGraph) =>
    EphemeraPositionGraph.fromPlayEnvelope(HOST_ID, envelope)

describe('evaluateRelationalLegality', () => {
    it('allows establish when both nodes are on graph with clean topology', () => {
        expect(evaluateRelationalLegality({
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            normalizedRelation: { type: 'enum', kind: 'On' },
            graph: graphFromEnvelope(roomGraphWithObjects),
        })).toEqual({ type: 'allow' })
    })

    it('allows idempotent establish when exact edge already present', () => {
        expect(evaluateRelationalLegality({
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            normalizedRelation: { type: 'enum', kind: 'On' },
            graph: graphFromEnvelope({ ...roomGraphWithObjects, edges: [onTableEdge] } as unknown as PlayPositionGraph),
        })).toEqual({ type: 'allow' })
    })

    it('returns complexRelational when conflicting topology exists', () => {
        expect(evaluateRelationalLegality({
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            normalizedRelation: { type: 'enum', kind: 'Under' },
            graph: graphFromEnvelope({ ...roomGraphWithObjects, edges: [onTableEdge] } as unknown as PlayPositionGraph),
        })).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
    })

    it('returns notOnHostGraph when subject is absent from graph', () => {
        expect(evaluateRelationalLegality({
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            normalizedRelation: { type: 'enum', kind: 'On' },
            graph: graphFromEnvelope({
                nodes: [{ tag: 'Object' as const, universalKey: tableId }],
                edges: [],
            } as unknown as PlayPositionGraph),
        })).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.notOnHostGraph,
        })
    })

    it('allows dissolve when matching edge exists', () => {
        expect(evaluateRelationalLegality({
            operationKind: 'dissolveRelation',
            subjectId: broomId,
            targetId: tableId,
            normalizedRelation: { type: 'enum', kind: 'On' },
            graph: graphFromEnvelope({ ...roomGraphWithObjects, edges: [onTableEdge] } as unknown as PlayPositionGraph),
        })).toEqual({ type: 'allow' })
    })

    it('returns dissolveNoMatchingEdge when no matching edge exists', () => {
        expect(evaluateRelationalLegality({
            operationKind: 'dissolveRelation',
            subjectId: broomId,
            targetId: tableId,
            normalizedRelation: { type: 'enum', kind: 'On' },
            graph: graphFromEnvelope(roomGraphWithObjects),
        })).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.dissolveNoMatchingEdge,
        })
    })
})
