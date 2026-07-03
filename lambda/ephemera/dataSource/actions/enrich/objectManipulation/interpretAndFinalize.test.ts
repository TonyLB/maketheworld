import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    finalizeComplexityFromEnrich,
    interpretObjectManipulationComplexityBody,
} from './interpretAndFinalize'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId

describe('interpretObjectManipulationComplexityBody', () => {
    it('accepts atomic takeHold JSON without objectSpan', () => {
        expect(interpretObjectManipulationComplexityBody(
            '{"disposition":"atomic","operationKind":"takeHold"}'
        )).toEqual({
            success: true,
            response: {
                disposition: 'atomic',
                operationKind: 'takeHold',
            },
        })
    })

    it('accepts complex disposition JSON', () => {
        expect(interpretObjectManipulationComplexityBody(
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
        expect(interpretObjectManipulationComplexityBody(
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
        const parsed = interpretObjectManipulationComplexityBody(
            '{"disposition":"atomic","operationKind":"takeHold","objectId":"OBJECT#Broom"}'
        )
        expect(parsed.success).toBe(false)
    })

    it('rejects objectSpan on atomic response', () => {
        const parsed = interpretObjectManipulationComplexityBody(
            '{"disposition":"atomic","operationKind":"takeHold","objectSpan":"broom"}'
        )
        expect(parsed.success).toBe(false)
    })
})

describe('finalizeComplexityFromEnrich', () => {
    it('finalizes atomic takeHold to grounded ObjectManipulation', () => {
        expect(finalizeComplexityFromEnrich(
            0.9,
            broomId,
            {
                disposition: 'atomic',
                operationKind: 'takeHold',
            },
            false
        )).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'takeHold',
            objectId: broomId,
            confidence: 0.9,
        })
    })

    it('finalizes complex disposition to Error', () => {
        expect(finalizeComplexityFromEnrich(
            0.9,
            broomId,
            {
                disposition: 'complex',
                complexityClass: 'relationalPlacement',
            },
            false
        )).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.complexRelational,
        })
    })

    it('finalizes atomic drop to grounded ObjectManipulation', () => {
        expect(finalizeComplexityFromEnrich(
            0.85,
            broomId,
            {
                disposition: 'atomic',
                operationKind: 'drop',
            },
            false
        )).toEqual({
            type: 'ObjectManipulation',
            operationKind: 'drop',
            objectId: broomId,
            confidence: 0.85,
        })
    })

    it('returns Error for unimplemented atomic operationKind', () => {
        expect(finalizeComplexityFromEnrich(
            0.85,
            broomId,
            {
                disposition: 'atomic',
                operationKind: 'placeOn',
            },
            false
        )).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        })
    })

    it('returns Error when complexity invoke failed', () => {
        expect(finalizeComplexityFromEnrich(0.85, broomId, null, true)).toEqual({
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.enrichInvokeFailed,
        })
    })
})
