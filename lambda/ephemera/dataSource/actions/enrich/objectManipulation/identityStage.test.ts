import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { runIdentityStage } from './identityStage'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('runIdentityStage', () => {
    it('resolves span deterministically without Bedrock', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn()

        const result = await runIdentityStage(
            'pick up the broom',
            ['broom'],
            roomCatalog,
            { invokeBedrockObjectManipulationIdentityImpl }
        )

        expect(result).toEqual({
            type: 'success',
            spanGroundings: [{
                type: 'resolved',
                objectId: broomId,
                catalogScope: 'room',
            }],
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).not.toHaveBeenCalled()
    })

    it('invokes identity LLM on NoMatch', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: `{"objectId":"${broomId}"}`,
        })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            roomCatalog,
            { invokeBedrockObjectManipulationIdentityImpl }
        )

        expect(result).toEqual({
            type: 'success',
            spanGroundings: [{
                type: 'resolved',
                objectId: broomId,
                catalogScope: 'room',
            }],
        })
        expect(invokeBedrockObjectManipulationIdentityImpl).toHaveBeenCalled()
    })

    it('fails closed when identity LLM returns invalid JSON', async () => {
        const invokeBedrockObjectManipulationIdentityImpl = jest.fn().mockResolvedValue({
            success: true,
            body: 'not json',
        })

        const result = await runIdentityStage(
            'pick up the thing',
            ['thing'],
            roomCatalog,
            { invokeBedrockObjectManipulationIdentityImpl }
        )

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.identityParseFailed,
        })
    })

    it('returns noCatalog error when catalog is empty and span does not match', async () => {
        const result = await runIdentityStage('pick up broom', ['broom'], [])

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })
})
