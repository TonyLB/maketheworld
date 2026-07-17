import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import { interpretIdentityOnlyFallbackBody } from './interpretIdentityOnlyFallback'

describe('interpretIdentityOnlyFallbackBody', () => {
    it('parses a valid unfenced JSON response', () => {
        const body = JSON.stringify({ candidates: [{ objectId: 'OBJECT#Bag', confidence: 0.8 }] })
        expect(interpretIdentityOnlyFallbackBody(body)).toEqual({
            success: true,
            candidates: [{ objectId: 'OBJECT#Bag', confidence: 0.8 }],
        })
    })

    it('parses a valid fenced JSON response', () => {
        const body = '```json\n' + JSON.stringify({ candidates: [{ objectId: 'OBJECT#Bag', confidence: 0.8 }] }) + '\n```'
        expect(interpretIdentityOnlyFallbackBody(body)).toEqual({
            success: true,
            candidates: [{ objectId: 'OBJECT#Bag', confidence: 0.8 }],
        })
    })

    it('fails on unparseable JSON', () => {
        expect(interpretIdentityOnlyFallbackBody('not json')).toEqual({
            success: false,
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed,
        })
    })

    it('fails when candidates is not an array', () => {
        const body = JSON.stringify({ candidates: 'nope' })
        expect(interpretIdentityOnlyFallbackBody(body)).toEqual({
            success: false,
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed,
        })
    })

    it('fails when candidates is empty', () => {
        const body = JSON.stringify({ candidates: [] })
        expect(interpretIdentityOnlyFallbackBody(body)).toEqual({
            success: false,
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed,
        })
    })

    it('fails when a confidence is out of range', () => {
        const body = JSON.stringify({ candidates: [{ objectId: 'OBJECT#Bag', confidence: 1.5 }] })
        expect(interpretIdentityOnlyFallbackBody(body)).toEqual({
            success: false,
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed,
        })
    })

    it('fails when objectId is an empty string', () => {
        const body = JSON.stringify({ candidates: [{ objectId: '', confidence: 0.5 }] })
        expect(interpretIdentityOnlyFallbackBody(body)).toEqual({
            success: false,
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed,
        })
    })
})
