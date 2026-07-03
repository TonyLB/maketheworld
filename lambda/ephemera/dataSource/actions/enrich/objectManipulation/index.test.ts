import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardExitEdgeData } from '@tonylb/mtw-wml/ts/standardize/keys/edges/dataTypes/exitEdge'

import { enrichObjectManipulation } from './index'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const roomId = 'ROOM#Bridge' as EphemeraRoomId
const tableId = 'OBJECT#Table' as EphemeraObjectId
const characterId = 'CHARACTER#Player' as EphemeraCharacterId
const catalog = [{ objectId: broomId, normalizedShortName: 'broom' }]

const touchingEdge: StandardExitEdgeData = {
    tag: 'Exit',
    uuid: 'edge-1',
    from: broomId,
    to: tableId,
    payload: {},
}

const graphWithTouchingEdge = { nodes: [], edges: [touchingEdge] }

describe('enrichObjectManipulation', () => {
    it('returns grounded takeHold without Bedrock on zero-hop eligible path', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.92,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationIdentityImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.92,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('returns grounded drop without Bedrock on zero-hop eligible path', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await enrichObjectManipulation(
            {
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                characterId,
                heldInventoryCatalog: catalog,
            },
            0.91,
            {
                invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationIdentityImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectId: broomId,
            confidence: 0.91,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('returns Error for complex disposition stub via cardinality', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom and the anvil',
                rawObjectSpans: ['broom', 'anvil'],
                roomObjectCatalog: catalog,
            },
            0.8,
            { invokeBedrockObjectManipulationEnrichImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiObject,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
    })

    it('short-circuits multiObject via cardinality gate without Bedrock', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn()

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom and the anvil',
                rawObjectSpans: ['broom', 'anvil'],
                roomObjectCatalog: catalog,
            },
            0.8,
            { invokeBedrockObjectManipulationEnrichImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiObject,
        })
        expect(invokeBedrockObjectManipulationEnrichImpl).not.toHaveBeenCalled()
    })

    it('blocks takeHold when object is multi-present', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId, 'ROOM#Hall'])
        const getPositionGraph = jest.fn()

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiPresent,
        })
        expect(getPositionGraph).not.toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })

    it('blocks takeHold when object has no membership host', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([])
        const getPositionGraph = jest.fn()

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.9,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noMembershipHost,
        })
    })

    it('invokes complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"complex","complexityClass":"relationalPlacement"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
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

    it('finalizes atomic drop from complexity LLM when exit edges touch object', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"atomic","operationKind":"drop"}',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([characterId])
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

        const result = await enrichObjectManipulation(
            {
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                characterId,
                heldInventoryCatalog: catalog,
            },
            0.85,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectId: broomId,
            confidence: 0.85,
        })
        expect(invokeBedrockObjectManipulationComplexityImpl).toHaveBeenCalled()
    })

    it('returns parse failure Error when complexity body is invalid', async () => {
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue(graphWithTouchingEdge)

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.85,
            {
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result.type).toBe('Error')
        if (result.type === 'Error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.enrichParseFailed)
        }
    })

    it('invokes identity LLM when deterministic resolve fails', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })
        const invokeBedrockObjectManipulationComplexityImpl = jest.fn()
        const getMembershipContainers = jest.fn().mockResolvedValue([roomId])
        const getPositionGraph = jest.fn().mockResolvedValue({ nodes: [], edges: [] })

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the sweeping tool',
                rawObjectSpans: ['sweeping tool'],
                roomObjectCatalog: catalog,
            },
            0.88,
            {
                invokeBedrockObjectManipulationIdentityImpl,
                invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: { getMembershipContainers, getPositionGraph },
            }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.88,
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalled()
        expect(invokeBedrockObjectManipulationComplexityImpl).not.toHaveBeenCalled()
    })
})
