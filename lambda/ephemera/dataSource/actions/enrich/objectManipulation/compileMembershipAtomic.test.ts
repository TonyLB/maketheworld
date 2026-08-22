import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { testLudicGraph, testLudicGraphFromEnvelope } from '../../../positions/ludicGraph/testFixtures'
import { compileMembershipAtomic } from './compileMembershipAtomic'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const pouchId = 'OBJECT#Pouch' as EphemeraObjectId
const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const broomCatalog = [{ objectId: broomId, normalizedShortName: 'broom' }]
const pouchCatalog = [{ objectId: pouchId, normalizedShortName: 'pouch' }]
const bagCatalog = [{ objectId: bagId, normalizedShortName: 'bag' }]

const touchingEdge: StandardExitEdgeData = {
    tag: 'Exit',
    uuid: 'edge-1',
    from: broomId,
    to: tableId,
    payload: {},
}

const graphWithTouchingEdge = testLudicGraphFromEnvelope(roomId, { nodes: [], edges: [touchingEdge] })
const emptyRoomGraph = testLudicGraph(roomId)
const emptyCharacterGraph = testLudicGraph(characterId)

/** Room and character graph fetches are now both issued (Slice 4b) before selection runs; respond by hostId. */
const hostAwareGetLudicGraph = (overrides: Record<string, unknown> = {}) =>
    jest.fn().mockImplementation(async (hostId: string) => (
        overrides[hostId] ?? (hostId === characterId ? emptyCharacterGraph : emptyRoomGraph)
    ))

describe('compileMembershipAtomic', () => {
    it('returns takeHold for room object with acquire verbClass', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: broomCatalog,
            },
            0.92,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectIds: [broomId],
            confidence: 0.92,
        })
    })

    it('BD-20: rejects a multi-span frame (arity check now lives here, after Identify, not ahead of it) without invoking the complexity LLM', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom and the bag',
                rawObjectSpans: ['broom', 'bag'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [...broomCatalog, ...bagCatalog],
            },
            0.8,
            {
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
                invokeBedrockObjectManipulationComplexityImpl,
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiObject,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
        expect(getLudicGraph).not.toHaveBeenCalled()
    })

    it('returns drop for held-only release paraphrase (toss the pouch)', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await compileMembershipAtomic(
            {
                command: 'toss the pouch',
                rawObjectSpans: ['pouch'],
                verbClass: 'release',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [],
                heldInventoryCatalog: pouchCatalog,
            },
            0.88,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectIds: [pouchId],
            confidence: 0.88,
        })
    })

    it('returns notCarryingObject when release disagrees with room sole host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await compileMembershipAtomic(
            {
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: broomCatalog,
                heldInventoryCatalog: [],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.notCarryingObject,
        })
    })

    it('returns alreadyHoldingObject when acquire disagrees with actor character sole host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [],
                heldInventoryCatalog: broomCatalog,
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.alreadyHoldingObject,
        })
    })

    it('does not short-circuit relational commands (routing is at enrich entry)', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()

        const result = await compileMembershipAtomic(
            {
                command: 'put the broom on the table',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: broomCatalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getLudicGraph: hostAwareGetLudicGraph(),
                },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.notCarryingObject,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('invokes complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"complex","complexityClass":"relationalPlacement"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph({ [roomId]: graphWithTouchingEdge })

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: broomCatalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).toHaveBeenCalled()
    })

    // Slice 3's "carry-related object (glass On tray)" test is retired 2026-08-22 (Channel D,
    // CD2, reduced scope): it tested `On`'s carry absorption end to end, which is now dead --
    // `On` joined `In`/`PartOf`'s hosting-kind throw in `classifyInteractionUnderTransfer`, and
    // `carry` is unreachable from any relation kind. Real shard-based hosting (CD2h) is what
    // would eventually carry the glass along again.

    it('FT-2.2 illegal-if-wrong: drop bag selects held satchel over room bag', async () => {
        const getMembershipContainers = jest.fn().mockImplementation(async (objectId: EphemeraObjectId) => (
            objectId === satchelId ? [characterId] : [roomId]
        ))
        const getLudicGraph = hostAwareGetLudicGraph()

        // Duplicate exact label "bag" at room + held loci (ambiguous exact pool).
        const result = await compileMembershipAtomic(
            {
                command: 'drop the bag',
                rawObjectSpans: ['bag'],
                verbClass: 'release',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: bagCatalog,
                heldInventoryCatalog: [{ objectId: satchelId, normalizedShortName: 'bag' }],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectIds: [satchelId],
            confidence: 0.9,
        })
    })

    it('FT-3.1 thin-margin consult egresses as Consult with alternatives', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        // Duplicate exact "broom" labels -> multi-exact pool; selector consults (both legal takeHold).
        const result = await compileMembershipAtomic(
            {
                command: 'take the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                    { objectId: mopId, normalizedShortName: 'broom' },
                ],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getLudicGraph } }
        )

        expect(result).toEqual({
            type: 'Consult',
            confidence: 0.9,
            alternatives: [
                { proposedCommand: 'take the broom', objectId: broomId },
                { proposedCommand: 'take the broom', objectId: mopId },
            ],
        })
        // Post-selection observation (containers/multiPresent) is never reached on Consult egress;
        // the room/character graph pre-fetch (Slice 4b) runs unconditionally before selection, though.
        expect(getMembershipContainers).not.toHaveBeenCalled()
    })

    it('FT-3.2 grey-band egresses as Abstain (not Consult, not Error)', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getLudicGraph = hostAwareGetLudicGraph()

        const result = await compileMembershipAtomic(
            {
                command: 'take the sword',
                rawObjectSpans: ['sword'],
                verbClass: 'acquire',
                characterId,
                hostRoomId: roomId,
                roomObjectCatalog: [
                    { objectId: broomId, normalizedShortName: 'broom' },
                ],
            },
            0.9,
            {
                positionsReadDeps: { getMembershipContainers, getLudicGraph },
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
        expect(getMembershipContainers).not.toHaveBeenCalled()
    })
})
