import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    objectManipulationErrorMessageForResolution,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const duplicateId = 'OBJECT#Duplicate' as EphemeraObjectId
const otherDuplicateId = 'OBJECT#Duplicate2' as EphemeraObjectId

describe('resolveObjectSpanToObjectId', () => {
    const catalog = [
        { objectId: broomId, normalizedShortName: 'broom' },
        { objectId: duplicateId, normalizedShortName: 'mug' },
        { objectId: otherDuplicateId, normalizedShortName: 'mug' },
    ]

    it('resolves a unique normalized shortName match', () => {
        expect(resolveObjectSpanToObjectId('broom', catalog)).toEqual({
            type: 'Resolved',
            objectId: broomId,
        })
    })

    it('returns NoCatalog when catalog is empty or missing', () => {
        expect(resolveObjectSpanToObjectId('broom', [])).toEqual({ type: 'NoCatalog' })
        expect(resolveObjectSpanToObjectId('broom', undefined)).toEqual({ type: 'NoCatalog' })
    })

    it('returns NoMatch when span does not match any catalog entry', () => {
        expect(resolveObjectSpanToObjectId('rocket skates', catalog)).toEqual({ type: 'NoMatch' })
    })

    it('returns AmbiguousMatch when multiple objects share the same shortName', () => {
        expect(resolveObjectSpanToObjectId('mug', catalog)).toEqual({ type: 'AmbiguousMatch' })
    })

    it('maps resolution failures to stable error messages', () => {
        expect(objectManipulationErrorMessageForResolution({ type: 'NoMatch' }))
            .toContain('no such object')
        expect(objectManipulationErrorMessageForResolution({ type: 'AmbiguousMatch' }))
            .toContain('ambiguous object')
    })
})
