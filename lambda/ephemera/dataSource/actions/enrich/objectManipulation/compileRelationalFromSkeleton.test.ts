import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testPositionGraph } from '../../../positions/positionGraph/testFixtures'
import { compileRelationalFromSkeleton } from './compileRelationalFromSkeleton'
import type { ParseSkeleton } from './parse/parseToken'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const benchAId = 'OBJECT#BenchA' as EphemeraObjectId
const benchBId = 'OBJECT#BenchB' as EphemeraObjectId
const lampId = 'OBJECT#Lamp' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const characterId = 'CHARACTER#Alpha' as EphemeraCharacterId

const relationalSkeleton = (
    verb: string,
    subjectSpan: string,
    subjectKey: string,
    prep: string,
    targetSpan: string,
    targetKey: string
): ParseSkeleton => [
    { type: 'text', text: verb },
    { type: 'objectSpan', span: subjectSpan, stableRefKey: subjectKey },
    { type: 'text', text: prep },
    { type: 'objectSpan', span: targetSpan, stableRefKey: targetKey },
]

describe('compileRelationalFromSkeleton', () => {
    it('returns EstablishRelation for a matched closed-template command with grounded catalog', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put broom on table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'on', 'table', 'tableRef'),
                characterId,
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

    it('grounds "put bench on bench" to two distinct benches, not a self-relation (BD-23)', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: benchAId },
                    { tag: 'Object' as const, universalKey: benchBId },
                ],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put bench on bench',
                skeleton: relationalSkeleton('put', 'bench', 'benchRef1', 'on', 'bench', 'benchRef2'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: benchAId, normalizedShortName: 'bench' },
                    { objectId: benchBId, normalizedShortName: 'bench' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result.type).toBe('EstablishRelation')
        if (result.type === 'EstablishRelation') {
            expect(result.subjectId).not.toBe(result.targetId)
            expect([benchAId, benchBId]).toContain(result.subjectId)
            expect([benchAId, benchBId]).toContain(result.targetId)
        }
    })

    it('returns nestingRelational Error for containment prepositions', async () => {
        const result = await compileRelationalFromSkeleton(
            {
                command: 'put coin in jar',
                skeleton: relationalSkeleton('put', 'coin', 'coinRef', 'in', 'jar', 'jarRef'),
                characterId,
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.nestingRelational,
        })
    })

    it('abstains when the skeleton does not match the closed relational template', async () => {
        const result = await compileRelationalFromSkeleton(
            {
                command: 'balance broom carefully on table',
                skeleton: [
                    { type: 'text', text: 'balance' },
                    { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
                    { type: 'text', text: 'carefully on' },
                    { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
                ],
                characterId,
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Abstain',
            confidence: 0.9,
            reason: objectManipulationErrorMessages.relationalNoTemplateMatch,
        })
    })

    it('returns noHostRoom Error when hostRoomId is absent', async () => {
        const result = await compileRelationalFromSkeleton(
            {
                command: 'put broom on table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'on', 'table', 'tableRef'),
                characterId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        })
    })

    it('returns noHostRoom Error when characterId is absent', async () => {
        const result = await compileRelationalFromSkeleton(
            {
                command: 'put broom on table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'on', 'table', 'tableRef'),
                hostRoomId: roomId,
            },
            0.9
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noHostRoom,
        })
    })

    it('abstains when the only grounded candidate is an illegal self-relation', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: lampId }],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put lamp on lamp',
                skeleton: relationalSkeleton('put', 'lamp', 'lampRef1', 'on', 'lamp', 'lampRef2'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: lampId, normalizedShortName: 'lamp' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph } }
        )

        expect(result.type).toBe('Abstain')
        expect((result as { confidence: number }).confidence).toBe(0.9)
    })

    it('abstains when a span resolves to no catalog candidates', async () => {
        const getPositionGraph = jest.fn().mockResolvedValue(
            testPositionGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: tableId }],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put sword on table',
                skeleton: relationalSkeleton('put', 'sword', 'swordRef', 'on', 'table', 'tableRef'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: tableId, normalizedShortName: 'table' }],
            },
            0.9,
            {
                positionsReadDeps: { getMembershipContainers: jest.fn(), getPositionGraph },
                embedSpan: jest.fn().mockResolvedValue({ success: true, embedding: [0.01, 0.02, 0.03] }),
            }
        )

        expect(result.type).toBe('Abstain')
    })
})
