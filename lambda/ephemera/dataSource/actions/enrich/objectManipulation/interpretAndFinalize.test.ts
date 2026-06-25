import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    finalizeObjectManipulationFromEnrich,
    interpretObjectManipulationEnrichBody,
} from './interpretAndFinalize'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const catalog = [{ objectId: broomId, normalizedShortName: 'broom' }]

describe('interpretObjectManipulationEnrichBody', () => {
    it('accepts atomic takeHold JSON', () => {
        expect(interpretObjectManipulationEnrichBody(
            '{"disposition":"atomic","operationKind":"takeHold","objectSpan":"broom"}'
        )).toEqual({
            success: true,
            response: {
                disposition: 'atomic',
                operationKind: 'takeHold',
                objectSpan: 'broom',
            },
        })
    })

    it('accepts complex disposition JSON', () => {
        expect(interpretObjectManipulationEnrichBody(
            '{"disposition":"complex","complexityClass":"relationalPlacement","summary":"put vase on table"}'
        )).toEqual({
            success: true,
            response: {
                disposition: 'complex',
                complexityClass: 'relationalPlacement',
                summary: 'put vase on table',
            },
        })
    })

    it('accepts multiPresent complex disposition JSON', () => {
        expect(interpretObjectManipulationEnrichBody(
            '{"disposition":"complex","complexityClass":"multiPresent"}'
        )).toEqual({
            success: true,
            response: {
                disposition: 'complex',
                complexityClass: 'multiPresent',
            },
        })
    })

    it('rejects forbidden object id fields', () => {
        const parsed = interpretObjectManipulationEnrichBody(
            '{"disposition":"atomic","operationKind":"takeHold","objectSpan":"broom","objectId":"OBJECT#Broom"}'
        )
        expect(parsed.success).toBe(false)
    })
})

describe('finalizeObjectManipulationFromEnrich', () => {
    it('finalizes atomic takeHold to grounded ObjectManipulation', () => {
        expect(finalizeObjectManipulationFromEnrich(
            0.9,
            {
                disposition: 'atomic',
                operationKind: 'takeHold',
                objectSpan: 'broom',
            },
            false,
            catalog
        )).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.9,
        })
    })

    it('finalizes complex disposition to Error', () => {
        expect(finalizeObjectManipulationFromEnrich(
            0.9,
            {
                disposition: 'complex',
                complexityClass: 'relationalPlacement',
            },
            false,
            catalog
        )).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
    })

    it('finalizes multiPresent complex disposition to Error', () => {
        expect(finalizeObjectManipulationFromEnrich(
            0.9,
            {
                disposition: 'complex',
                complexityClass: 'multiPresent',
            },
            false,
            catalog
        )).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexMultiPresent,
        })
    })

    it('finalizes unimplemented atomic operationKind to Error', () => {
        expect(finalizeObjectManipulationFromEnrich(
            0.9,
            {
                disposition: 'atomic',
                operationKind: 'drop',
                objectSpan: 'broom',
            },
            false,
            catalog
        )).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        })
    })

    it('finalizes ambiguous resolve to Error', () => {
        expect(finalizeObjectManipulationFromEnrich(
            0.9,
            {
                disposition: 'atomic',
                operationKind: 'takeHold',
                objectSpan: 'missing',
            },
            false,
            catalog
        )).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        })
    })
})
