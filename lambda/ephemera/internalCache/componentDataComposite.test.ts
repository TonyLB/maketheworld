jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    createComponentDataCacheHandler,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import { createImprovisationComponentDataCacheHandler } from '@tonylb/mtw-gateways/ts/ephemera/improvisation'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import { createEphemeraComponentDataCompositeCacheHandler } from './componentDataComposite'

const assetMock = assetDB as jest.Mocked<typeof assetDB>
const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const assetA = 'ASSET#Base' as const
const objectId = 'OBJECT#skates' as const

describe('EphemeraComponentDataCompositeCache', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    const createComposite = () => {
        const assetComponentData = createComponentDataCacheHandler(assetMock)
        const improvisationComponentData = createImprovisationComponentDataCacheHandler(ephemeraMock)
        const composite = createEphemeraComponentDataCompositeCacheHandler({
            assetComponentData,
            improvisationComponentData,
        })
        return { composite, assetComponentData, improvisationComponentData }
    }

    it('routes getAcrossAssets to assetDB and ephemeraDB by asset id', async () => {
        assetMock.getItems.mockResolvedValue([{
            DataCategory: assetA,
            AssetId: objectId,
            tag: 'Object',
            shortName: 'canon skates',
        }])
        ephemeraMock.getItems.mockResolvedValue([{
            EphemeraId: objectId,
            DataCategory: IMPROVISATION_ASSET_ID,
            tag: 'Object',
            shortName: 'roller skates',
        }])

        const { composite } = createComposite()
        const output = await composite.getAcrossAssets(objectId, [assetA, IMPROVISATION_ASSET_ID])

        expect(output[assetA].component.toJSON()).toMatchObject({
            tag: 'Object',
            shortName: 'canon skates',
        })
        expect(output[IMPROVISATION_ASSET_ID].component.toJSON()).toMatchObject({
            tag: 'Object',
            shortName: 'roller skates',
        })
        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(assetMock.getItems).toHaveBeenCalledWith({
            Keys: [{ AssetId: objectId, DataCategory: assetA }],
            getAllFields: true,
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [{ EphemeraId: objectId, DataCategory: IMPROVISATION_ASSET_ID }],
            getAllFields: true,
        })
    })

    it('does not query ephemeraDB for asset-only stacks', async () => {
        assetMock.getItems.mockResolvedValue([{
            DataCategory: assetA,
            AssetId: 'FEATURE#TestOne',
            tag: 'Feature',
        }])

        const { composite } = createComposite()
        await composite.getAcrossAssets('FEATURE#TestOne', [assetA])

        expect(assetMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).not.toHaveBeenCalled()
    })

    it('shares improvisation memo between composite set and improvisation handler get', async () => {
        ephemeraMock.getItems.mockResolvedValue([])

        const { composite, improvisationComponentData } = createComposite()
        const component = new StandardObject({
            tag: 'Object',
            universalKey: objectId,
            shortName: 'memo skates',
        })

        composite.set(objectId, IMPROVISATION_ASSET_ID, component)
        const row = await improvisationComponentData.get(objectId, IMPROVISATION_ASSET_ID)

        expect(row.component.toJSON()).toMatchObject({ shortName: 'memo skates' })
        expect(ephemeraMock.getItems).not.toHaveBeenCalled()
    })

    it('routes blueprint set to asset handler only', async () => {
        ephemeraMock.getItems.mockResolvedValue([])

        const { composite, improvisationComponentData } = createComposite()
        const feature = new StandardFeature({
            tag: 'Feature',
            universalKey: 'FEATURE#TestOne',
        })

        composite.set('FEATURE#TestOne', assetA, feature)
        await composite.getAcrossAssets('FEATURE#TestOne', [assetA])

        expect(assetMock.getItems).not.toHaveBeenCalled()
        await expect(improvisationComponentData.get(objectId, IMPROVISATION_ASSET_ID)).resolves.toBeDefined()
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
    })

    it('propagates clear and flush to both delegates', async () => {
        const { composite, assetComponentData, improvisationComponentData } = createComposite()
        const assetClearSpy = jest.spyOn(assetComponentData, 'clear')
        const improvisationClearSpy = jest.spyOn(improvisationComponentData, 'clear')
        const assetFlushSpy = jest.spyOn(assetComponentData, 'flush').mockResolvedValue()
        const improvisationFlushSpy = jest.spyOn(improvisationComponentData, 'flush').mockResolvedValue()

        composite.clear()
        await composite.flush()

        expect(assetClearSpy).toHaveBeenCalledTimes(1)
        expect(improvisationClearSpy).toHaveBeenCalledTimes(1)
        expect(assetFlushSpy).toHaveBeenCalledTimes(1)
        expect(improvisationFlushSpy).toHaveBeenCalledTimes(1)
    })
})
