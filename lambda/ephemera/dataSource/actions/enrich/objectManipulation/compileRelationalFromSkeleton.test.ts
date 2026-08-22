import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { testLudicGraph } from '../../../positions/ludicGraph/testFixtures'
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
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: broomId },
                    { tag: 'Object' as const, universalKey: tableId },
                ],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put broom under table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: tableId, normalizedShortName: 'table' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: broomId,
            targetId: tableId,
            relationKind: 'Under',
            hostId: roomId,
            confidence: 0.9,
        })
    })

    it('grounds "put bench under bench" to two distinct benches, not a self-relation (BD-23)', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [
                    { tag: 'Object' as const, universalKey: benchAId },
                    { tag: 'Object' as const, universalKey: benchBId },
                ],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put bench under bench',
                skeleton: relationalSkeleton('put', 'bench', 'benchRef1', 'under', 'bench', 'benchRef2'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: benchAId, normalizedShortName: 'bench' },
                    { objectId: benchBId, normalizedShortName: 'bench' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
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
                command: 'put broom under table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
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
                command: 'put broom under table',
                skeleton: relationalSkeleton('put', 'broom', 'broomRef', 'under', 'table', 'tableRef'),
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
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: lampId }],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put lamp under lamp',
                skeleton: relationalSkeleton('put', 'lamp', 'lampRef1', 'under', 'lamp', 'lampRef2'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: lampId, normalizedShortName: 'lamp' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph } }
        )

        expect(result.type).toBe('Abstain')
        expect((result as { confidence: number }).confidence).toBe(0.9)
    })

    it('abstains when a span resolves to no catalog candidates', async () => {
        const getLudicGraph = jest.fn().mockResolvedValue(
            testLudicGraph(roomId, {
                nodes: [{ tag: 'Object' as const, universalKey: tableId }],
            })
        )

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put sword under table',
                skeleton: relationalSkeleton('put', 'sword', 'swordRef', 'under', 'table', 'tableRef'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: tableId, normalizedShortName: 'table' }],
            },
            0.9,
            {
                positionsReadDeps: { getMembershipContainers: jest.fn().mockResolvedValue([roomId]), getLudicGraph },
                embedSpan: jest.fn().mockResolvedValue({ success: true, embedding: [0.01, 0.02, 0.03] }),
            }
        )

        expect(result.type).toBe('Abstain')
    })

    it('inserts a transferMembership repair when the subject is held but the target is in the room (BD-16 sameHost repaired)', async () => {
        const trayId = 'OBJECT#Tray' as EphemeraObjectId
        const roomGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: tableId }],
        })
        const heldGraph = testLudicGraph(characterId, {
            nodes: [{ tag: 'Object' as const, universalKey: trayId }],
        })
        const getLudicGraph = jest.fn().mockImplementation(async (hostId: string) => (
            hostId === characterId ? heldGraph : roomGraph
        ))
        const getMembershipContainers = jest.fn().mockImplementation(async (objectId: string) => (
            objectId === trayId ? [characterId] : [roomId]
        ))

        const result = await compileRelationalFromSkeleton(
            {
                command: 'put tray under table',
                skeleton: relationalSkeleton('put', 'tray', 'trayRef', 'under', 'table', 'tableRef'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: tableId, normalizedShortName: 'table' }],
                heldInventoryCatalog: [{ objectId: trayId, normalizedShortName: 'tray' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'EstablishRelation',
            operationKind: 'establishRelation',
            subjectId: trayId,
            targetId: tableId,
            relationKind: 'Under',
            hostId: roomId,
            confidence: 0.9,
            transferFromHostId: characterId,
        })
    })

    it('drops a Custom-relation candidate whose subject/object hosts differ (sameHost defer --- no Consult path on this route)', async () => {
        const charmId = 'OBJECT#Charm' as EphemeraObjectId
        const necklaceId = 'OBJECT#Necklace' as EphemeraObjectId
        const roomGraph = testLudicGraph(roomId, {
            nodes: [{ tag: 'Object' as const, universalKey: charmId }],
        })
        const heldGraph = testLudicGraph(characterId, {
            nodes: [{ tag: 'Object' as const, universalKey: necklaceId }],
        })
        const getLudicGraph = jest.fn().mockImplementation(async (hostId: string) => (
            hostId === characterId ? heldGraph : roomGraph
        ))
        const getMembershipContainers = jest.fn().mockImplementation(async (objectId: string) => (
            objectId === necklaceId ? [characterId] : [roomId]
        ))

        const result = await compileRelationalFromSkeleton(
            {
                command: 'wrap charm around necklace',
                skeleton: relationalSkeleton('put', 'charm', 'charmRef', 'around', 'necklace', 'necklaceRef'),
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [{ objectId: charmId, normalizedShortName: 'charm' }],
                heldInventoryCatalog: [{ objectId: necklaceId, normalizedShortName: 'necklace' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result.type).toBe('Abstain')
    })
})
