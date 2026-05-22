jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

const assetDBMock = jest.mocked(assetDB)

import internalCache from './index'

describe('diagnostics internalCache', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
    })

    it('clear invokes ComponentData.clear and ComponentVerticals.clear', () => {
        const dataClear = jest.spyOn(internalCache.ComponentData, 'clear')
        const verticalsClear = jest.spyOn(internalCache.ComponentVerticals, 'clear')

        internalCache.clear()

        expect(dataClear).toHaveBeenCalledTimes(1)
        expect(verticalsClear).toHaveBeenCalledTimes(1)
    })

    it('ComponentData.get delegates to assetDB getItems for pair reads', async () => {
        assetDBMock.getItems.mockResolvedValue([])
        const componentId = 'ROOM#12345' as const
        const assetId = 'ASSET#Test' as const
        const result = await internalCache.ComponentData.get(componentId, assetId)
        expect(result.component.universalKey).toBe(componentId)
        expect(result.assetId).toBe(assetId)
        expect(assetDBMock.getItems).toHaveBeenCalledWith({
            Keys: [{ AssetId: componentId, DataCategory: assetId }],
            getAllFields: true,
        })
    })

    it('ComponentVerticals.get delegates to assetDB query', async () => {
        assetDBMock.query.mockResolvedValue([] as any)
        const universalKey = 'ROOM#Vortex' as const
        const [entry] = await internalCache.ComponentVerticals.get([universalKey])
        expect(entry).toEqual({ universalKey, hops: [] })
        expect(assetDBMock.query).toHaveBeenCalled()
    })
})
