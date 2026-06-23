import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { enrichObjectManipulation } from './index'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const catalog = [{ objectId: broomId, normalizedShortName: 'broom' }]

describe('enrichObjectManipulation', () => {
    it('returns grounded takeHold when Bedrock returns atomic JSON', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"atomic","operationKind":"takeHold","objectSpan":"broom"}',
        })

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.92,
            { invokeBedrockObjectManipulationEnrichImpl }
        )

        expect(result).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.92,
        })
    })

    it('returns Error for complex disposition stub', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"complex","complexityClass":"multiObject"}',
        })

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
    })

    it('returns Error for unimplemented atomic operationKind', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: '{"disposition":"atomic","operationKind":"drop","objectSpan":"broom"}',
        })

        const result = await enrichObjectManipulation(
            {
                command: 'drop the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.85,
            { invokeBedrockObjectManipulationEnrichImpl }
        )

        expect(result).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        })
    })

    it('returns parse failure Error when enrich body is invalid', async () => {
        const invokeBedrockObjectManipulationEnrichImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })

        const result = await enrichObjectManipulation(
            {
                command: 'pick up the broom',
                rawObjectSpans: ['broom'],
                roomObjectCatalog: catalog,
            },
            0.85,
            { invokeBedrockObjectManipulationEnrichImpl }
        )

        expect(result.type).toBe('Error')
        if (result.type === 'Error') {
            expect(result.errorMessage).toBe(objectManipulationErrorMessages.enrichParseFailed)
        }
    })
})
