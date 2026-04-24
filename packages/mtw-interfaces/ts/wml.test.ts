import { isWMLAPIMessage } from './wml'

describe('isWMLAPIMessage', () => {
    it('accepts promoteToCanon with AssetId', () => {
        expect(
            isWMLAPIMessage({
                message: 'promoteToCanon',
                AssetId: 'ASSET#abc',
            })
        ).toBe(true)
    })

    it('accepts applyEdit with required fields', () => {
        expect(
            isWMLAPIMessage({
                message: 'applyEdit',
                AssetId: 'ASSET#x',
                schema: 'foo',
            })
        ).toBe(true)
    })

    it('rejects null', () => {
        expect(isWMLAPIMessage(null)).toBe(false)
    })

    it('rejects non-object', () => {
        expect(isWMLAPIMessage('applyEdit')).toBe(false)
    })

    it('rejects missing message', () => {
        expect(isWMLAPIMessage({ AssetId: 'ASSET#x' })).toBe(false)
    })

    it('rejects unknown message string', () => {
        expect(isWMLAPIMessage({ message: 'unknownOp' })).toBe(false)
    })

    it('rejects non-string message', () => {
        expect(isWMLAPIMessage({ message: 1 })).toBe(false)
    })
})
