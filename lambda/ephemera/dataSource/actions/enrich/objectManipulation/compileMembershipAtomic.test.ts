import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { compileMembershipAtomic } from './compileMembershipAtomic'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { agreementFailureConfidence } from './verbMembershipAgreement'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const pouchId = 'OBJECT#Pouch' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const broomCatalog = [{ objectId: broomId, normalizedShortName: 'broom' }]
const pouchCatalog = [{ objectId: pouchId, normalizedShortName: 'pouch' }]

const touchingEdge: StandardExitEdgeData = {
    tag: 'Exit',
    uuid: 'edge-1',
    from: broomId,
    to: tableId,
    payload: {},
}

const graphWithTouchingEdge = { nodes: [], edges: [touchingEdge] }

describe('compileMembershipAtomic', () => {
    it('returns takeHold for room object with acquire verbClass', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                roomObjectCatalog: broomCatalog,
            },
            0.92,
            { positionsReadDeps: { getMembershipContainers, getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.92,
        })
    })

    it('returns drop for held-only release paraphrase (toss the pouch)', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await compileMembershipAtomic(
            {
                command: 'toss the pouch',
                rawObjectSpans: ['pouch'],
                verbClass: 'release',
                characterId,
                roomObjectCatalog: [],
                heldInventoryCatalog: pouchCatalog,
            },
            0.88,
            { positionsReadDeps: { getMembershipContainers, getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectId: pouchId,
            confidence: 0.88,
        })
    })

    it('returns notCarryingObject when release disagrees with room sole host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await compileMembershipAtomic(
            {
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                characterId,
                roomObjectCatalog: broomCatalog,
                heldInventoryCatalog: [],
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.notCarryingObject,
        })
    })

    it('returns alreadyHoldingObject when acquire disagrees with actor character sole host', async () => {
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                characterId,
                roomObjectCatalog: [],
                heldInventoryCatalog: broomCatalog,
            },
            0.9,
            { positionsReadDeps: { getMembershipContainers, getPositionGraph } }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.alreadyHoldingObject,
        })
    })

    it('does not short-circuit relational commands (routing is at enrich entry)', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()

        const result = await compileMembershipAtomic(
            {
                command: 'put the broom on the table',
                rawObjectSpans: ['broom'],
                verbClass: 'release',
                roomObjectCatalog: broomCatalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationIdentityImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: {
                    getMembershipContainers: jest.fn().mockResolvedValue([roomId]),
                    getPositionGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
                },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.notCarryingObject,
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('downgrades agreement failure confidence via agreementFailureConfidence helper', () => {
        expect(agreementFailureConfidence(0.94)).toBe(0.5)
        expect(agreementFailureConfidence(0.3)).toBe(0.3)
    })

    it('invokes complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"complex","complexityClass":"relationalPlacement"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

        const result = await compileMembershipAtomic(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                verbClass: 'acquire',
                roomObjectCatalog: broomCatalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).toHaveBeenCalled()
    })
})
