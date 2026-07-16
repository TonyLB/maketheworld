import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../../../positions/positionGraph/testFixtures'
import { compileRelational } from './compileRelational'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { EphemeraPositionRelationalEdgeData } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId

const roomGraphWithObjects = testPositionGraph(roomId, {
    nodes: [
        { tag: 'Object' as const, universalKey: broomId },
        { tag: 'Object' as const, universalKey: tableId },
    ],
})

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
            hostId: roomId,
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
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
                edges: [onTableEdge],
            })
        )

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
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
                edges: [onTableEdge],
            })
        )

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
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: ropeId },
                    { tag: 'Object' as const, universalKey: crateId },
                ],
            })
        )

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

    it('returns Consult when subject pool is thin-margin ambiguous', async () => {
        const mopId = 'OBJECT#Mop' as EphemeraObjectId
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: mopId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
            })
        )

        // Duplicate exact "broom" labels -> multi-exact subject pool; selector consults.
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
                    { objectId: mopId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'Consult',
            confidence: 0.9,
            alternatives: [
                { proposedCommand: 'put the broom on the table', objectId: broomId },
                { proposedCommand: 'put the broom on the table', objectId: mopId },
            ],
        })
    })

    it('returns Abstain when subject is unfit grey-band against unary catalog', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: tableId },
                    { tag: 'Object' as const, universalKey: broomId },
                ],
            })
        )

        const result = await compileRelational(
            {
                command: 'put sword on table',
                subjectSpan: 'sword',
                targetSpan: 'table',
                relationSpan: 'on',
                operationKind: 'establishRelation',
                rawObjectSpans: ['sword'],
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            {
                positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph },
                embedSpan: jest.fn().mockResolvedValue({
                    success: true,
                    embedding: [0.01, 0.02, 0.03],
                }),
            }
        )

        expect(result.type).toBe('Abstain')
        if (result.type === 'Abstain') {
            expect(result.confidence).toBe(0.9)
            expect(result.reason).toBe(objectManipulationErrorMessages.noMatch)
        }
    })
})
