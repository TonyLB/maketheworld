import {
    DEFAULT_WML_STANDARDIZE_MODE,
    isWmlStandardizeMode,
    resolveStandardizeFromSchemaContext,
    resolveStandardizeMode,
} from './wmlStandardizeMode'

describe('wmlStandardizeMode', () => {
    it('defaults to asset', () => {
        expect(DEFAULT_WML_STANDARDIZE_MODE).toBe('asset')
    })

    it('isWmlStandardizeMode narrows known literals', () => {
        expect(isWmlStandardizeMode('asset')).toBe(true)
        expect(isWmlStandardizeMode('ephemeraWire')).toBe(true)
        expect(isWmlStandardizeMode('other')).toBe(false)
        expect(isWmlStandardizeMode(undefined)).toBe(false)
    })

    it('resolveStandardizeMode uses default when omitted', () => {
        expect(resolveStandardizeMode(undefined)).toBe('asset')
        expect(resolveStandardizeMode('ephemeraWire')).toBe('ephemeraWire')
    })

    it('resolveStandardizeFromSchemaContext fills standardizeMode', () => {
        expect(resolveStandardizeFromSchemaContext(undefined).standardizeMode).toBe('asset')
        expect(
            resolveStandardizeFromSchemaContext({ standardizeMode: 'ephemeraWire' }).standardizeMode
        ).toBe('ephemeraWire')
    })
})
