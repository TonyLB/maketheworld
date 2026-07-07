import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { catalogHasDuplicateNormalizedShortNames } from './catalogHasDuplicateNormalizedShortNames'
import type { EmbeddingMatchCandidate } from './types'

const candidate = (
    objectId: EphemeraObjectId,
    normalizedShortName: string
): EmbeddingMatchCandidate => ({
    objectId,
    normalizedShortName,
    catalogScope: 'room',
})

describe('catalogHasDuplicateNormalizedShortNames', () => {
    it('returns false for distinct normalized shortNames', () => {
        expect(
            catalogHasDuplicateNormalizedShortNames([
                candidate('OBJECT#a' as EphemeraObjectId, 'broom'),
                candidate('OBJECT#b' as EphemeraObjectId, 'anvil'),
            ])
        ).toBe(false)
    })

    it('returns true when two entries share the same normalized shortName', () => {
        expect(
            catalogHasDuplicateNormalizedShortNames([
                candidate('OBJECT#a' as EphemeraObjectId, 'lantern'),
                candidate('OBJECT#b' as EphemeraObjectId, 'Lantern'),
            ])
        ).toBe(true)
    })
})
