import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'

import { compileRelational } from './compileRelational'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

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

describe('compileRelational', () => {
    it('returns EstablishRelation for enum relation with grounded catalog', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue(roomGraphWithObjects)

        const result = await compileRelational(
            {
                command: 'put broom on table',
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                operationKind: 'establishRelation',
                rawObjectSpans: ['broom'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            relationKind: 'On',
            hostRoomId: roomId,
            confidence: 0.9,
        })
    })

    it('returns nestingRelational Error for containment relationSpan', async () => {
        const result = await compileRelational(
            {
                command: 'put coin in jar',
                subjectSpan: 'coin',
                targetSpan: 'jar',
                relationSpan: 'in',
                operationKind: 'establishRelation',
                rawObjectSpans: ['coin'],
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        })
    })

    it('returns noHostRoom Error when hostRoomId is absent', async () => {
        const result = await compileRelational(
            {
                command: 'put broom on table',
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                operationKind: 'establishRelation',
                rawObjectSpans: ['broom'],
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        })
    })

    it('allows idempotent establish when exact edge already present', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue({
            ...roomGraphWithObjects,
            edges: [onTableEdge],
        } as unknown as PlayPositionGraph)

        const result = await compileRelational(
            {
                command: 'put broom on table',
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'on',
                operationKind: 'establishRelation',
                rawObjectSpans: ['broom'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result.type).toBe('EstablishRelation')
    })

    it('returns complexRelational Error when conflicting topology exists', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue({
            ...roomGraphWithObjects,
            edges: [onTableEdge],
        } as unknown as PlayPositionGraph)

        const result = await compileRelational(
            {
                command: 'put broom under table',
                subjectSpan: 'broom',
                targetSpan: 'table',
                relationSpan: 'under',
                operationKind: 'establishRelation',
                rawObjectSpans: ['broom'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
    })

    it('returns dissolveNoMatchingEdge when dissolve has no matching edge', async () => {
        const ropeId = 'OBJECT#Rope' as EphemeraObjectId
        const crateId = 'OBJECT#Crate' as EphemeraObjectId
        const getPositionGraph = jest.fn().mockResolvedValue({
            nodes: [
                { tag: 'Object' as const, universalKey: ropeId },
                { tag: 'Object' as const, universalKey: crateId },
            ],
            edges: [],
        } as unknown as PlayPositionGraph)

        const result = await compileRelational(
            {
                command: 'take rope off crate',
                subjectSpan: 'rope',
                targetSpan: 'crate',
                relationSpan: 'off',
                operationKind: 'dissolveRelation',
                rawObjectSpans: ['rope'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: ropeId, normalizedShortName: 'rope' },
                    { objectId: crateId, normalizedShortName: 'crate' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.dissolveNoMatchingEdge,
        })
    })
})
