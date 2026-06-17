import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { createImprovisationComponentDataCacheHandler } from './factory'
import type { EphemeraImprovisationReadDB } from './fetch'

const objectId = 'OBJECT#CoyoteAnvil' as const
const otherAssetId = 'ASSET#draft[player]' as const

describe('ImprovisationComponentDataCache', () => {
    it('loads improvisation pair from ephemeraDB getItems', async () => {
        const db: EphemeraImprovisationReadDB = {
            getItems: jest.fn().mockResolvedValue([
                {
                    EphemeraId: objectId,
                    DataCategory: IMPROVISATION_ASSET_ID,
                    tag: 'Object',
                    shortName: 'Anvil',
                },
            ]),
        }
        const handler = createImprovisationComponentDataCacheHandler(db)

        const row = await handler.get(objectId, IMPROVISATION_ASSET_ID)

        expect(row.component).toBeInstanceOf(StandardObject)
        expect(row.component.toJSON()).toMatchObject({
            tag: 'Object',
            universalKey: objectId,
            shortName: 'Anvil',
        })
        expect(db.getItems).toHaveBeenCalledTimes(1)
    })

    it('memo set avoids second Dynamo read', async () => {
        const db: EphemeraImprovisationReadDB = {
            getItems: jest.fn().mockResolvedValue([]),
        }
        const handler = createImprovisationComponentDataCacheHandler(db)
        const component = new StandardObject({
            tag: 'Object',
            universalKey: objectId,
            shortName: 'Cached',
        })

        handler.set(objectId, IMPROVISATION_ASSET_ID, component)
        const row = await handler.get(objectId, IMPROVISATION_ASSET_ID)

        expect(row.component.toJSON()).toMatchObject({ shortName: 'Cached' })
        expect(db.getItems).not.toHaveBeenCalled()
    })

    it('invalidate drops memo so next get re-queries', async () => {
        const db: EphemeraImprovisationReadDB = {
            getItems: jest.fn().mockResolvedValue([
                {
                    EphemeraId: objectId,
                    DataCategory: IMPROVISATION_ASSET_ID,
                    tag: 'Object',
                    shortName: 'Fresh',
                },
            ]),
        }
        const handler = createImprovisationComponentDataCacheHandler(db)

        await handler.get(objectId, IMPROVISATION_ASSET_ID)
        handler.invalidate(objectId, IMPROVISATION_ASSET_ID)
        await handler.get(objectId, IMPROVISATION_ASSET_ID)

        expect(db.getItems).toHaveBeenCalledTimes(2)
    })

    it('rejects non-improvisation assetId', async () => {
        const db: EphemeraImprovisationReadDB = { getItems: jest.fn() }
        const handler = createImprovisationComponentDataCacheHandler(db)

        await expect(handler.get(objectId, otherAssetId)).rejects.toThrow(/ASSET#IMPROVISATION/)
    })
})
