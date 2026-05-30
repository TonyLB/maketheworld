import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

import type { ComponentDataCache } from './componentDataCache'
import { authoritativeFromParticipationOrder, ParticipationBatchError } from './participationBatch'

function defaultRoom(universalKey: ComponentUUID) {
    const defaultData = defaultComponentFromTag('Room', undefined, universalKey)
    const { component } = standardComponentFactory(defaultData)
    if (!component) {
        throw new Error('expected default room')
    }
    return component
}

describe('authoritativeFromParticipationOrder', () => {
    it('throws on empty mergeParticipationOrder', async () => {
        const componentData = { getAcrossAssets: jest.fn() } as unknown as ComponentDataCache
        await expect(
            authoritativeFromParticipationOrder('ROOM#r1', [], componentData)
        ).rejects.toThrow(ParticipationBatchError)
    })

    it('returns byAssets only for participation order assets in order', async () => {
        const universalKey = 'ROOM#r1' as ComponentUUID
        const order = ['ASSET#base', 'ASSET#layer'] as AssetUUID[]
        const base = defaultRoom(universalKey)
        const layer = defaultRoom(universalKey)
        const componentData = {
            getAcrossAssets: jest.fn().mockResolvedValue({
                'ASSET#base': { component: base },
                'ASSET#layer': { component: layer },
            }),
        } as unknown as ComponentDataCache

        const auth = await authoritativeFromParticipationOrder(universalKey, order, componentData)

        expect(componentData.getAcrossAssets).toHaveBeenCalledWith(universalKey, order)
        expect(auth.ComponentId).toBe(universalKey)
        expect(auth.byAssets).toHaveLength(2)
        expect(auth.byAssets.map((x) => x.AssetId)).toEqual(order)
        expect(auth.byAssets[0].component).toBe(base)
        expect(auth.byAssets[1].component).toBe(layer)
    })
})
